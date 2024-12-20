if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
const express = require("express");
const app = express();
const mongoose = require("mongoose");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const dbUrl = process.env.ATLASDB_URL;
const ExpressError = require("./utils/ExpressError");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

const flash = require("connect-flash");
//-------------------------EJS setup-------------------------------//
const path = require("path"); //
app.set("view engine", "ejs"); //
app.set("views", path.join(__dirname, "views")); //
app.use(express.urlencoded({ extended: true }));

//-------------------------Static files (public/css) setup-------------------------------//
app.use(express.static(path.join(__dirname, "/public")));
//-------------------------method-override setup-------------------------------//
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

//-------------------------EJS-mate setup-------------------------------//
const ejsMate = require("ejs-mate");
const { log, error } = require("console");
app.engine("ejs", ejsMate);

// Recommendation 1: Favicon handler
app.get("/favicon.ico", (req, res) => res.status(204));

// Recommendation 2: Request logging middleware
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path}`);
  next();
});

const session = require("express-session");
const MongoStore = require("connect-mongo");
const { url } = require("inspector");

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});
store.on("error", () => {
  console.log("error in mongo store", err);
});
const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
// use static serialize and deserialize of model for passport session support
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;

  next();
});

app.get("/demouser", async (req, res) => {
  let fakeUser = new User({
    email: "student@gmail.com",
    username: "Mayank",
  });
  let registeredUser = await User.register(fakeUser, "Helloworld");
  res.send(registeredUser);
});

main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

app.use("/listings", listingRouter);

app.use("/listings/:id/reviews", reviewRouter);

app.use("/", userRouter);

//!page not found
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found! "));
});

//middleware to catch error
app.use((err, req, res, next) => {
  console.error("error caught:", err.stack);
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

app.listen(8080, () => {
  console.log("Server is listening to port 8080");
});
