const express =require('express');
const WhatsappCloud = require('whatsappcloudapi_wrapper');



const message_500= 'Internalserver error'
const mes_success ='Successful request'

const router= express.Router()

const EcommmerceStore = require('../utils/utils')

const Store = new EcommmerceStore()
const CustomerSession = new Map();



const WhatsApp = new WhatsappCloud({
    accessToken:process.env.META_WA_ACCESS_TOKEN,
    senderPhoneNumberId: process.env.META_WA_SENDER_PHONE_NUMBER_ID,
    WABA_ID: process.env.META_WA_ACCOUNT_BUSINESS_ID,
    graphAPIVersion:'v15.0',

})


router.get('/whatsapp_callback_url',async (req,res)=>{
    try {
        console.log('Pinging this server')
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge =req.query['hub.challenge'];

        if(mode && token && mode === 'subscribe' && process.env.META_WA_VERIFY_TOKEN === token) {
            return res.status(200).send(challenge)
        }
        else{
            return res.sendStatus(403)
        }

        
    } catch (error) {
        return res.status(500).json(message_500)
    }

})
router.post('/whatsapp_callback_url',async (req,res) =>{
   try {

        let data = WhatsApp.parseMessage(req.body);

        if(data?.isMessage){
            let incomingMessage= data.message;
            let recipientPhone= incomingMessage.from.phone;
            let recipientName=incomingMessage.from.name;
            let typeOfMessage=incomingMessage.type;
            let messageId= incomingMessage.message_id

            if(!CustomerSession.get(recipientPhone)){
                CustomerSession.set(recipientPhone,{
                    cart:[]
                })
            }

            let addToCart =async({productId,recipientPhone})=>{
                let product =await Store._getProductsById(productId);
                if(product.status === 'success'){
                   CustomerSession.get(recipientPhone).cart.push(product.data) 
                }
            }
            let listOfItemsinCart =({recipientPhone})=>{
                let total=0
                let products=CustomerSession.get(recipientPhone).cart;
                total=products.reduce((acc,product) => acc+ product.price,total)
                let count =products.length;
                return {total,products,count}
            }

            let clearCart=({recipientPhone})=>{
                CustomerSession.get(recipientPhone).cart=[]
            }

             if (typeOfMessage === 'text_message') {
                await WhatsApp.sendSimpleButtons({
                    recipientPhone:recipientPhone,
                    message:`Hey ${recipientName},\nYou are speeaking to a Kevin's chatbot \n How do you wish to proceed? `,
                    listOfButtons:[
                        {
                            title:'View some products',
                            id:"see_categories"
                        },
                        {
                            title:'Speak to my Human',
                            id:'speak_to_a_human'
                        }
                    ]
                })
             }

             if(typeOfMessage === 'simple_button_message'){

                let button_id = incomingMessage.button_reply.id
                if(button_id === 'speak_to_a_human'){
                    await WhatsApp.sendText({
                        recipientPhone:recipientPhone,
                        message:'Argubly chatbots are faster than humans \n Call Kevin from the contact details provided below'
                    })

                    await WhatsApp.sendContact({
                        recipientPhone:recipientPhone,

                        contact_profile:{
                            addresses: [{
                                city: 'Kendu Bay,Homabay',
                                country: "Kenya"
                            }],
                            name: {
                                first_name: "Kevin",
                                last_name: "Ogum Junior"
                            },
                             org: {
                                 company: 'TheOgumKevinShop'
                             },
                              phones: [{
                                      phone: '+254701589214'
                                  },
                                  {
                                      phone: '+25601589214'
                                  }
                              ]

                        }
                        
                       
                       

                        
                    })
                }
                if(button_id.startsWith("add_to_cart_")){
                  let productId= button_id.split('add_to_cart_')[1];
                  await addToCart({recipientPhone,productId});
                  let numberOfItemsInCart = listOfItemsinCart({recipientPhone})

                  await WhatsApp.sendSimpleButtons({
                    recipientPhone:recipientPhone,
                    message:`We have updated your cart\n You have ${numberOfItemsInCart.count} items in your cart\n How do you wish to proceed?`,
                    listOfButtons:[
                        { 
                        title:'Checkout🛒',
                        id:'checkout'
                        },
                        {
                            title:"See more categories",
                            id:'see_categories'
                        }
                    ]
                  })
                }

                if(button_id ==='checkout'){
                   let finalBill = listOfItemsinCart({recipientPhone}) ;

                   let invoiceText=`List of items in the cart:\n`;
                   finalBill.products.forEach((item,index) => {
                        let serial =index+1;
                        invoiceText+=`\n${serial} : ${item.title} @ $${item.price}`
                   });

                   invoiceText+=`\n\n Total value of purchase is:$${finalBill.total}`

                   Store.generateProductInvoice({
                    order_details:invoiceText,
                    file_path:`./invoice_${recipientName}.pdf`
                   })

                   await WhatsApp.sendText({
                    message:invoiceText,
                    recipientPhone:recipientPhone
                   })

                   await WhatsApp.sendSimpleButtons({
                    message:`Thank you for shpping with us ${recipientName}\n`,
                    recipientPhone:recipientPhone,
                    listOfButtons:[
                        {
                            title:"See more categories",
                            id:'see_categories'
                        },
                        {
                            title:"Print Invoice",
                            id:'print_invoice'
                        }
                    ]
                   })
                   clearCart({recipientPhone})

                }

                if(button_id==='print_invoice'){
                   await WhatsApp.sendDocument({
                    recipientPhone:recipientPhone,
                    caption:`The OgumKevin Shop #invoice${recipientName}`,
                    file_path:`./invoice_${recipientName}.pdf`,
                   }) 

                   let wareHouse = Store.generateRandomGeoLocation();

                   await WhatsApp.sendText({
                    recipientPhone:recipientPhone,
                    message:'You order has been fulfilled please come pick it up'
                   })

                   await WhatsApp.sendLocation({
                    recipientPhone:recipientPhone,
                    latitude:wareHouse.latitude,
                    longitude:wareHouse.longitude,
                    name:'The OgumKevin Shop',
                    address:wareHouse.address
                   })
                }

                if(button_id === 'see_categories'){
                    let categories= await Store._getAllCategories();
                
                    console.log('im also being pinged')
                    await WhatsApp.sendSimpleButtons({
                        recipientPhone:recipientPhone,
                        message:`We have several categories ${recipientName}\n Please chose one of them`,
                        listOfButtons: categories.data.map(category =>{
                            return({
                                title:category,
                                id:`category_${category}`
                            })
                        }).slice(0,3)
                    })
                }

                if(button_id.startsWith('category_')){
                    let selectedCategory=  button_id.split('_')[1];

                    let listOfProducts= await Store._getProductsInCategory(selectedCategory);
                    let listOfSections=[
                        {
                            title:`🏆 Top 3 :${selectedCategory} `.substring(0,24),
                            rows:listOfProducts.data.map(product =>{
                                let id = `product_${product.id}`.substring(0,256)
                                let title= product.title.substring(0,21);
                                let description=`${product.description}\n${product.price}`.substring(0,21)

                                return{
                                    id,
                                    title:`${title}`,
                                    description:`${description}`
                                }
                            }).slice(0,10)
                        }
                    ];

                    await WhatsApp.sendRadioButtons({
                        recipientPhone:recipientPhone,
                        headerText:`#Blackfriday Offers :${selectedCategory}`,
                        bodyText:`Our Santa 🎄 has lined up some great product for you ${recipientName} \n This are the best deals in town today\n Pick your while the offer lasts `,
                        footerText:'Powered by Cerium Inc',
                        listOfSections,
                    })
                }
             }
             if(typeOfMessage ==='radio_button_message'){
                let selectionId= incomingMessage.list_reply.id;

                if(selectionId.startsWith('product_')){
                   let productId=selectionId.split('_')[1];

                   let product = await Store._getProductsById(productId);
                   const {price,title,description,category,image:imageUrl,rating} = product.data

                   let emojiRating =(rvalue) =>{
                    rvalue= Math.floor(rvalue || 0);
                    let output =[];
                    for(let i=0 ; i<rvalue;i++) output.push('✨')
                    return output.length? output.join(''):'N/A';
                   }
                   let text = `_Title_: *${title.trim()}*\n\n\n`;
                   text += `_Description_: ${description.trim()}\n\n\n`;
                   text += `_Price_: $${price}\n`;
                   text += `_Category_: ${category}\n`;
                   text += `${rating?.count || 0} shoppers liked this product.\n`;
                   text += `_Rated_: ${emojiRating(rating?.rate)}\n`;

                   await WhatsApp.sendImage({
                    recipientPhone,
                    url:imageUrl,
                    caption:text
                   })

                   await WhatsApp.sendSimpleButtons({
                    message:"Here is the product,what do you want me to do next\n",
                    recipientPhone:recipientPhone,
                    listOfButtons:[
                        {
                            title:'Add to cart 🛒',
                            id:`add_to_cart_${productId}`
                        },
                        {
                            title:'Speak to a human',
                            id:'speak_to_a_human'
                        },
                        {
                            title:'See more products',
                            id:'see_categories',
                        },
                    ]
                   })
                }
             }
             //await WhatsApp.markMessageAsRead({messageId})
        }

       



        console.log('Someone is pinging me ')
        return res.status(200).json(mes_success);
        
    } catch (error) {
        return console.log(error)
   }
})

module.exports=router