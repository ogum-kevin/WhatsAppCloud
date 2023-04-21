require('dotenv').config();
const express = require('express');

const indexRoutes= require('./routes/index');

const main = async ()=>{

    const app = express()
    app.use(express.json());
    app.use(express.urlencoded({extended:false}));
    app.use('/',indexRoutes);
    app.use("*",(req,res) =>{ res.send('Invalid route server not found')})
    const PORT = process.env.PORT

    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`)
    })

}
main();

