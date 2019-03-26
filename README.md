# Shopify and MailChimp Connector (Test)

Connector between Shopify and MailChimp to facilitate the sync of customer data and subscription status.

## Setup

### Installing Dependencies
Clone or Download the package to your local.

> This application requires node.js and npm be installed.

After downloading, install the relevant dependencies by changing into the directory of the project and running:
```
$ npm install
```

### API Keys and Environment Vairables

API keys for **Shopify** and **MailChimp** are required to use the connector. These are passed in via **Environment Variables**, as is the name of the **MailChimp List** you wish to sync to.

Create a `.env` file with the following contents:   
```
MAILCHIMP_API_KEY=<your mailchimp api key>
MAILCHIMP_LIST_NAME=<mailchimp list name to sync to>
SHOPIFY_SHOP_NAME=<shopify shop name>
SHOPIFY_API_KEY=<shopify API key>
SHOPIFY_API_PASSWORD=<shopify API password>
```

## Build

To transpile the code to ES6 Javascript run:
```
$ npm run build
```

## Run

To run the compiled code run:
```
$ npm run start
```

## Build and Run
To both transpile and run straight away run:
```
$ npm run dev
```


## Requirements
- [x] Setup of trial Shopify and MailChimp accounts
- [x] Application should connect to both the Shopify Admin API and MailChimp API.
- [x] Application should sync all customer information from Shopify into a MailChimp list called 'Test Shopify Sync'
- [x] Application should sync total customer spend into a merge field within MailChimp
- [x] Application should sync the 'accepts marketing' status from within Shopify to MailChimp
- [x] Repositiory to include updated README.md with build/run/deploy instructions
- [x] Repositiory to include meaningful commit messages
- [x] Bonus points for use of TypeScript
- [x] Bonus points for use of well supported packages
- [ ] Bonus points for use of Serverless framework
- [x] Bonus points for use of Gitmoji
