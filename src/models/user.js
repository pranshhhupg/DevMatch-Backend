const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName : {
        type : String,
        required : true,
        minLength : 2,
        maxLength : 80,
    },
    lastName : {
        type : String,
        maxLength : 100,
    },
    emailId : {
        type : String,
        required : true,
        unique : true,
        immutable : true,
        trim : true,
        lowercase : true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error("Invalid email address");
            }
        }
    },
    password : {
        type : String,
        required: true,
        validate(value){
            if(!value || !validator.isStrongPassword(value)){
                throw new Error("Enter strong password");
            }
        }
    },
    age : {
        type : Number,
        default : null,
        min : 18
    },
    gender : {
        type : String,
        default : "other",
        enum : {
            values : ["male","female","other","Male","Female","Others"],
            message : '{VALUE} is not a valid gender type.'
        }
        // validate(value){
        //     if(!["male","female","other","Male","Female","Others"].includes(value)){
        //         throw new Error("Gender is invalid");
        //     }
        // }
    },
    photoUrl : {
        type : String,
        default : "https://thumbs.dreamstime.com/b/default-profile-picture-avatar-photo-placeholder-vector-illustration-default-profile-picture-avatar-photo-placeholder-vector-189495158.jpg?w=768",
        validate(value){
            if(!validator.isURL(value)){
                throw new Error("invalid url");
            }
        }
    },
    // Cloudinary public_id for the profile photo (used for deletion on re-upload)
    photoPublicId : {
        type : String,
        default : null,
    },
    about : {
        type : String,
        maxLength : 300,
        default : "Hi there! I am using DevTinder"
    },
    skills: {
        type: [String],
        default: [],
        validate(value) {
          if (value.length > 20) throw new Error("Maximum 20 skills allowed");
        },
      },
  
      // ── New Matching Fields ───────────────────────────────────
      lookingFor: {
        type: [String],
        enum: [
          "frontend dev",
          "backend dev",
          "full stack",
          "ml engineer",
          "ai engineer",
          "prompt engineer",
          "data scientist",
          "data analyst",
          "designer",
          "product manager",
          "devops",
          "mobile dev",
          "qa engineer",
          "blockchain dev",
          "consultant",
          "any",
        ],
        default: ["any"],
      },
      goals: {
        type: [String],
        enum: [
          "build a startup",
          "win hackathons",
          "learn new tech",
          "open source",
          "freelance",
          "get a job",
        ],
        default: [],
      },
      availability: {
        type: String,
        enum: ["weekends", "evenings", "full-time", "flexible"],
        default: "flexible",
      },
      experienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "intermediate",
      },
      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },
      hackathonInterest: { type: Boolean, default: false },
      startupInterest:   { type: Boolean, default: false },
      learningGoals: {
        type: [String],
        default: [],
      },
      projectIdeas: {
        type: [String],
        default: [],
      },
},
{
    timestamps : true,
});

userSchema.methods.getJWT = async function() {
    const user = this;

    const token = await jwt.sign({userId : user._id}, "devTinder@1210", {
        expiresIn : '1d'
    });

    return token;
}

userSchema.methods.validatePassword = async function(passwordGivenByUser) {
    const user = this;

    const isPasswordCorrect = await bcrypt.compare(passwordGivenByUser, user.password);
    
    return isPasswordCorrect;
}


module.exports = mongoose.model("User",userSchema);