const mongoose = require("mongoose");
const initdata = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL =  "mongodb://127.0.0.1:27017/whatsapp";

main().then(()=>{
    console.log("connecter to db");
})
.catch((err)=>{
    console.log(err);
})

async function main(){
    await mongoose.connect(MONGO_URL);
}
const initDB = async () =>{
    await Listing.deleteMany({});
    
  initdata.data = initdata.data.map((obj)=>({...obj , owner: "69107e3463f281e7ada62370"}));
    await Listing.insertMany(initdata.data);
    console.log("data was initialized");
}

initDB();
