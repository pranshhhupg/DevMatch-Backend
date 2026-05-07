const { default: mongoose } = require("mongoose");

const opportunitySchema = new mongoose.Schema({
    postedBy : {
        type : String,
        required : true,
        ref : "User",
    },
    title : {
        type : String,
        required : true,
        trim : true,
        minLength : 10,
        maxLength : 200,
    },
    description : {
        type : String,
        required : true,
        minLength : 10,
        trim : true,
    },
    location : {
        type : String,
        default : "",
        trim : true,
    },
    techStack : {
        type: [String],
        default : [],
    },
    teamSize: {
        type: Number,
        min: 1,
        max: 100,
    },
        level: {
        type: String,
        enum: ["beginner", "intermediate", "expert", "any"],
        default: "any",
    },
        rolesNeeded: {
        type: [String],
        default: [],
    },
        applyLink: {
        type: String,
        default: "",
        trim: true,
    },
        isActive: {
        type: Boolean,
        default: true,
    },
},
    { timestamps: true }
);

// Compound index for the common filter path
opportunitySchema.index({ type: 1, location: 1, level: 1, isActive: 1 });
// For profile "my opportunities" lookup
opportunitySchema.index({ postedBy: 1, createdAt: -1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);
  