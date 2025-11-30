const listing = require("./models/listing.js");
const expresserror = require("./utils/expresserror.js");
const {listingschema , reviewschema} = require("./schema.js");
const Review = require("./models/reviews.js");

module.exports.isLoggedIn = (req , res , next)=>{
     if(!req.isAuthenticated()){
       req.session.redirectUrl = req.originalUrl;
     req.flash("error","You must be loggedin!");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveredirectUrl = (req , res ,next)=>{
   if(req.session.redirectUrl){
      res.locals.redirectUrl = req.session.redirectUrl;
   }
   next();
} ;

module.exports.isOwner = async (req,res,next)=>{
    let { id } = req.params;
    let rlisting = await listing.findById(id);
    if(!rlisting.owner._id.equals(res.locals.currUser._id)){
      req.flash("error", " owner required !");  
      req.redirect(`/listing/${id}`);
    } 
    next();
};
module.exports.validatelisting = (req,res,next)=>{
     let {error} = listingschema.validate(req.body);

        if(error){
            let errmsg = error.details.map( el => el.message).join(",");
            throw new expresserror(400 , errmsg);
        }else{
            next();
        }

};


module.exports.validatereview = (req,res,next)=>{
   
        let {error} = reviewschema.validate(req.body);
   
           if(error){
               let errmsg = error.details.map( el => el.message).join(",");
               throw new expresserror(400 , errmsg);
           }else{
               next();
           }
   
};
module.exports.isReviewAuthor = async (req,res,next)=>{
    let { id ,reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)){
      req.flash("error", " author required !");  
      req.redirect(`/listing/${id}`);
    } 
    next();
};