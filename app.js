if (process.env.NODE_ENV != "production") {
    require('dotenv').config();
}


const express = require("express");
const app = express();
const port = 3000;
const mongoose = require("mongoose");
const listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapasync = require("./utils/wrapasync.js");
const expresserror = require("./utils/expresserror.js");
const { listingschema, reviewschema } = require("./schema.js");
const Review = require("./models/reviews.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const { isLoggedIn, saveredirectUrl, isOwner, validatelisting, validatereview, isReviewAuthor } = require("./middleware.js");

// upload files on cloud
const multer = require('multer');
const dburl = process.env.ATLASDB_URL;

const { storage } = require("./CoudConfig.js");
const upload = multer({ storage });


console.log("DB URL:", dburl);

const store = MongoStore.create({
    mongoUrl :dburl,
    collectionName: "sessions",
    touchAfter : 24*3600,
});

store.on("error",function (err){
    console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
    store,
    secret:process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};


app.use(session(sessionOptions));
app.use(flash());
// for passport we needed to add 2 more app.use just after session 

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

// user se related jitnee bhi informatioin hai usko session me store kraten hai with the help of serializeUser  and if the User will end his session the we unserializeUser means remove info from session 
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));


app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
})

main().then((res) => {
    console.log("connection successfull", res);
}).catch((err) => {
    console.log("failed to connect", err)
});

async function main() {
    await mongoose.connect(dburl);

};

app.get("/", (req, res) => {
    res.render("listings/index");
});


app.get("/listings", (async (req, res) => {
    const allisting = await listing.find({});

    res.render("listings/index", { allisting });
}));

app.get("/login", (req, res) => {
    res.render("users/login.ejs");
});
app.post("/login", saveredirectUrl, passport.authenticate("local", { failureRedirect: "/login", failureFlash: true }), async (req, res) => {
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
})

app.get("/listings/new", isLoggedIn, (req, res) => {

    res.render("listings/new.ejs");

});

app.post("/listings", upload.single('listing[image]'), wrapasync(async (req, res, next) => {


    let url = req.file.path;
    let filename = req.file.filename;

    const newlist = new listing(req.body.listing);
    newlist.image = { filename, url };
    newlist.owner = req.user._id;
    await newlist.save();
    req.flash("success", "New Listing");
    res.redirect("listings");

}));

app.put("/listings/:id", isLoggedIn, upload.single("listing[image]"), validatelisting, wrapasync(async (req, res) => {

    let { id } = req.params;

    let listings = await listing.findByIdAndUpdate(id, { ...req.body.listing });
    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listings.image = { filename, url };
        await listings.save();
    }

    res.redirect("/listings");
}));
app.delete("/listings/:id", isLoggedIn, isOwner, wrapasync(async (req, res) => {
    let { id } = req.params;
    await listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted");
    res.redirect("/listings");
}));

app.get("/listings/:id", wrapasync(async (req, res) => {
    let { id } = req.params;


    const slisting = await listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");
    if (!slisting) {
        req.flash("error", "Does not exist");
      return res.redirect("/listings");
    }



    res.render("listings/show", { slisting })
}));

app.get("/listings/:id/edit", isLoggedIn, wrapasync(async (req, res) => {
    let { id } = req.params;
    const ed = await listing.findById(id);
    res.render("listings/edit", { ed });
}));

app.post("/listings/:id/reviews", isLoggedIn, validatereview, wrapasync(async (req, res) => {

    let { id } = req.params;
    let list = await listing.findById(id);
    let newReview = new Review(req.body.review);

    newReview.author = req.user._id;
    list.reviews.push(newReview);
    await newReview.save();
    await list.save();

    res.redirect(`/listings/${id}`);
}));

app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, wrapasync(async (req, res) => {
    let { id, reviewId } = req.params;

    await listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);


    res.redirect(`/listings/${id}`)
}));

app.get("/signup", (req, res) => {
    res.render("users/signup");
});

app.post("/signup", wrapasync(async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newuser = new User({ email, username });
        const c = await User.register(newuser, password);
        req.login(c, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", " successfull");
            return res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
}));

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        } else {
            req.flash("success", " Your are logged out");
            res.redirect("/listings");
        }
    });
});

app.use((req, res, next) => {
    next(new expresserror(404, "not found"));
});

app.use((err, req, res, next) => {

    if (res.headersSent) {
        return next(err);  
    }

    let { statuscode = 500, message = "Something went wrong" } = err;
    res.status(statuscode).render("error.ejs", { statuscode, message });
});
app.listen(port, () => {
    console.log("Started");
});