require('dotenv').config();
import Shopify = require('shopify-api-node');
import MailChimp = require('mailchimp-api-v3');
import { createHash } from 'crypto';

// Get MailChimp credentials from environment file
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_LIST_NAME = process.env.MAILCHIMP_LIST_NAME;

// Get Shopify variables from environment file
const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD;

// Create a new Shopify instance
const shopify = new Shopify({
    shopName: SHOPIFY_SHOP_NAME,
    apiKey: SHOPIFY_API_KEY,
    password: SHOPIFY_API_PASSWORD
  });

// Create a new MailChimp instance
const mailchimp = new MailChimp(MAILCHIMP_API_KEY);

// Function to pull all of the Shopify Customers
async function getShopifyCustomers(){
    const customers = await shopify.customer.list({})
        .then(customers => {
            return customers.map(cust=>{
                const {id,email,accepts_marketing,first_name,last_name,total_spent} = cust
                return {
                    id,
                    email,
                    accepts_marketing,
                    first_name,
                    last_name,
                    total_spent
                }
            });
        })
        .catch(err => {
            console.error(err);
            return undefined;
        });
    return customers;
}

// Function to get the MailChimp list Id based on the name of the list to sync to
async function getMailChimpListId(listName: string){
    const listId = await mailchimp.get('/lists')
        .then(res=>{
            let listWithName = res.lists && res.lists.find(list=>list.name == listName);
            return listWithName && listWithName.id || -1;
        })
        .catch(err=>{
            console.log(err);
            return -1;
        })
    return listId;
}

// Function to get the list of merge fields on the given MailChimp list
async function getMergeFields(mailChimpListId: string) {
    const mergeFields = await mailchimp.get({
        path: `/lists/${mailChimpListId}/merge-fields`
    }).then(res=>{
        return res;
    }).catch(err =>{
        console.error(err);
        return [];
    })

    return mergeFields;
}

// Function to create a MailChimp Member from a Shopify Account
function createMailChimpMemberFromShopifyCustomer(sCust) {
    return {
        "email_address": sCust.email,
        status: sCust["accepts_marketing"] ? 'subscribed' : 'unsubscribed',
        "merge_fields": {
            "FNAME": sCust["first_name"],
            "LNAME": sCust["last_name"],
            "TOTALSPENT": `${sCust["total_spent"]}`
        }
    }
}

// Function to generate a valid MailChimp API request
function generateMailChimpAPIrequest(method:string,mcListId,mcMember) {
    const emailHash = createHash('md5').update(mcMember['email_address'].toLowerCase()).digest("hex");
    let reqObj = {
        method: method,
        path: `/lists/${mcListId}/members/${emailHash}`,
        body: mcMember
    }
    return reqObj;
}


// Asyncronous IIFE to run asyncronous application logic in
(async function () {
    // Get all Shopify Customers
    let shopifyCustomers = await getShopifyCustomers();

    // Get the MailChimp List Id based on the MAILCHIMP_LIST_NAME environment variable
    let mailChimpListId = await getMailChimpListId(MAILCHIMP_LIST_NAME);

    // Get the MailChimp MERGE_FIELDS based with the above ID
    let mailChimpMergeFields = await getMergeFields(mailChimpListId);

    // Check is there is currently isn't a TOTALSPEND MERGE_FIELD and create one if there isn't
    if(mailChimpMergeFields['merge_fields'].find(field=>field.tag == 'TOTALSPENT') == undefined) {
        await mailchimp.post({
            path: `/lists/${mailChimpListId}/merge-fields`,
            body: {
                tag: 'TOTALSPENT',
                name: 'Total Spent',
                type: 'text',
                default_value: '0.00'
            }
        }).then(res=>{
            console.log(res);
        }).catch(err=>{
            console.log(err);
        });
    }
    
    // Get the MailChimp members based on the MailChimp List Id
    let mailchimpListMembers = await mailchimp.get({
        path: `/lists/${mailChimpListId}/members`
    }).then(res=>{
        return res && res.members || [];
    }).catch(err=>{
        console.error(err);
        return undefined;
    });

    // Basic Error Handling of getting Shopify Customers. return out of the program if list is undefined.
    if(shopifyCustomers == undefined) {
        console.error('Error retrieving Shopify Customers. Check Internet Access and API Credentials')
        return
    }

    // Basic Error Handling of getting MailChimp List Members. return out of the program if list is undefined.
    if(mailchimpListMembers == undefined){
        console.error('Error retrieving MailChimp Members. Check Internet Access and API Credentials')
        return
    }


    /* ############################################################
        Generate a list of MailChimp Members to Add / Update
        And the associated API calls to add/update them
       ############################################################ */

    // Generate a hash map of MailChimp Members to easily compare Shopify Customers against
    let mailChimpListMembersObj = mailchimpListMembers.reduce((accumulator, mcMember)=>{
        const mcMemberEmailLower = mcMember['email_address'].toLowerCase();
        accumulator[mcMemberEmailLower] = mcMember;
        return accumulator;
    }, {})

    // Compare the Shopify Customers against the hash map of MailChimp Members and add or update if required
    let updateObj = shopifyCustomers.reduce(function(accumulator:any,sCust){

        let mailChimpMember = mailChimpListMembersObj[sCust.email.toLocaleLowerCase()];

        // IF there's no mathching MailChimp member then we need to create it
        // ELSE update based on the new values from the mathcing Shopify Customer
        if(mailChimpMember == undefined){
            const newMailChimpMember = createMailChimpMemberFromShopifyCustomer(sCust);
            const batchRequest = generateMailChimpAPIrequest('put',mailChimpListId,newMailChimpMember);

            accumulator.toAdd.push(batchRequest);
        } else {
            let totalSpentChanged = mailChimpMember['merge_fields']['TOTALSPENT'] !== sCust['total_spent'];

            let firstNameChanged = mailChimpMember['merge_fields']['FNAME'] !== sCust['first_name'];
            let lastNameChanged = mailChimpMember['merge_fields']['LNAME'] !== sCust['last_name'];

            let mailChimpMemberStatus = mailChimpMember.status == 'subscribed';
            let marketingStatusChanged = mailChimpMemberStatus !== sCust['accepts_marketing'];

            if(totalSpentChanged || marketingStatusChanged || firstNameChanged || lastNameChanged) {
                const newMailChimpMember = createMailChimpMemberFromShopifyCustomer(sCust);
                const batchRequest = generateMailChimpAPIrequest('put',mailChimpListId,newMailChimpMember);

                accumulator.toUpdate.push(batchRequest)
            }
        }

        return accumulator;
    },<any>{
        toAdd: [],
        toUpdate: [],
        toDelete: []
    });


    /* ############################################################
        Generate a list of MailChimp Members to Delete
        And the associated API calls to delete them
       ############################################################ */

    // Generate a hash map of Shopify Customers
    let shopifyCustomersObj = shopifyCustomers.reduce((accumulator:any, sCust)=>{
        const sCustEmailLower = sCust.email.toLowerCase();
        accumulator[sCustEmailLower] = sCust;
        return accumulator;
    },<any>{})

    // Filter the MailChimp Members list to those that do not exist in the Shopify Customers hash map
    // Generate a DELETE API request for each
    updateObj.toDelete = mailchimpListMembers.filter(mcMember=>{
        const mcMemberEmail = mcMember['email_address'].toLowerCase();
        return shopifyCustomersObj[mcMemberEmail] == undefined;
    }).map(mcMember=>generateMailChimpAPIrequest('delete',mailChimpListId,mcMember));

    console.log('updateObj', JSON.stringify(updateObj,null,2));


    /* ############################################################
        Combine the API Calls together
        And Run them as a Batch API request
       ############################################################ */
    let mailChimpBatchArray = [...updateObj.toAdd, ...updateObj.toUpdate, ...updateObj.toDelete];

    console.log('updateObj', JSON.stringify(mailChimpBatchArray, null, 2));

    mailchimp.batch(mailChimpBatchArray).then(res=>{
        console.log(res);
    }).catch(err=>{
        console.error(err);
    });
    
})();
