require('dotenv').config();
import Shopify = require('shopify-api-node');
import MailChimp = require('mailchimp-api-v3');
import { createHash } from 'crypto';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_LIST_NAME = process.env.MAILCHIMP_LIST_NAME;

const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD;

const shopify = new Shopify({
    shopName: SHOPIFY_SHOP_NAME,
    apiKey: SHOPIFY_API_KEY,
    password: SHOPIFY_API_PASSWORD
  });

const mailchimp = new MailChimp(MAILCHIMP_API_KEY);

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
            return [];
        });
    return customers;
}

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

(async function () {
    let shopifyCustomers = await getShopifyCustomers();
    let mailChimpListId = await getMailChimpListId(MAILCHIMP_LIST_NAME);
    
    let mailchimpListMembers = await mailchimp.get({
        path: `/lists/${mailChimpListId}/members`
    }).then(res=>{
        return res && res.members || [];
        // console.log(res);
        let memberEmail = res.members[0]['email_address'];
        // let emailHash = createHash('md5').update(memberEmail).digest("hex");
        // console.log(emailHash);
    }).catch(err=>{
        console.error(err);
        return [];
    });

    console.log(shopifyCustomers);
    console.log(mailChimpListId);
    console.log(mailchimpListMembers);

})();


// shopify.customer.list({})
//     .then(customers => {
//         console.log(customers);
//     }).catch(err => {
//         console.error(err);
//     });

// console.log('Hello World...');