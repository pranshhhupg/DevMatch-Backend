-Create a repository
-Initialize the Repository
-node_modules, package.json, package-lock.json
-Install express
-Create a server
-Listen to port 7777
-Write request handlers for /test, /hello
-Install nodemon and update scripts inside package.json

-initialize git
-.gitignore
-Create a remote repo on github
-Push all code to remote origin
-Play with routes and route extensions ex. /hello, /, hello/2, /xyz
-Order of the routes matter a lot
-Install postman app and make a workspace/collection > test GET API call
-Write logic to handle GET,POST,PATCH,DELETE API Calls and test them on Postman
-Explore routing and use of ?, +, (), + in the routes
-params in route handler
-reading dynamic routes

-next();
-Middleware
-dummy auth middleware for user and admin
-Error handling

-create a free cluster on mongoDB official website(Mongo Atlas)
-Install mongoose library
-Connect your application to the Database "Connection-url/devTinder"
-Call the connectDB function and connect to database before starting application on 3007
-Create a userSchema and userModel
-Create POST/signup API to add data to database
-Puse some documents using API calls from postman


-JS object vs JSON Object (Difference)
-Add the express.json middleware to your app
-Make your signup API Dynamic to receive data from the end user
-User.findOne with duplicate emailIDs, which object returned.
-API - get user by email.
-API - FEED API - GET/feed - get all the users from the database.
-API - Update a user
-Explore the Mongoose Documentation for Model methods
-API - create Update and delete APIs

-Explore schema properties of document
-add required, unique, min, max etc;
-create custom validate function for gender
-Improve the DB Schema - Put the custom validation function in each field
-Add timestamps to userSchema
-Add API level validation on patch and post APIs
-Use validator
-Explore validator library like isEmail, isStrongPassword etc.
-///Never trust req.body///

-validate data in signup/post API
-Install Bcrypt package
-Create a password Hash Save the users with  encrypted password
-Create Login API
-Compare password using bcrypt.compare and throw errors if email or password is invalid

-install jsonwebtoken and cookie-parser
-create get/profile API
-create a JWT Token and send it back to user in cookies
-read the cookies insider your profile API and find the logged in user
-add the userAuth middlewarein profile API
-set the expiry of JWT and cookies to 7 days

-Explore tinder APIs
-Create a list all API you can think in DevTinder
-Group multiple routes under respective routers
-Create routes folder for managing auth, profile, request routers.  
-Import these routers in app.js
-Create POST/logout API
-Create PATCH/profile/edit
-Create PATCH/profile/password
-Make sure you validated all data in every POST, PATCH API.
-Test all APIs

-Create ConnectionRequestSchema
-create Connection Request API in requests.js
-Properly validate the data
-$or and $and query in mongoose. 
-Read more about indexes and compound indexes in MongoDB
-Why do we need indexes in DB?
-Adv and Disadv. of creating indexes?
-schema.pre("save", function(){});

-Write API for requestRouter.post("/request/review/:action/:requestId)
-Thought Process - POST vs GET

-Logic for get/FEED API
-Explore $nin, $ne etc..
-Add pagination to your /feed API

# DEPLOYMENT

-Signup on AWS
-Launch instance
- To connect to EC2 instance:

    cd ~/downloads
    chmod 400 "devTinder-secret-key.pem"
    ssh -i "devTinder-secret-key.pem" ubuntu@ec2-13-127-24-219.ap-south-1.compute.amazonaws.com

-Connect to instance using git bash and AWS keys
-Install exact same node version when connected to ec2 instance.
-Do git clone
-go to frontend using cd devTinder---FRONTEND
-For frontend
    -npm install
    -*npm run build
    -sudo apt update
    -sudo apt install nginx
    -sudo systemctl start nginx
    -sudo systemctl enable nginx
    -COPY CODE FROM dist(build files) to /var/www/html
    -*sudo scp -r  dist/*/ /var/www/html.
    -Enable port 80 on your instance.

-For backend
    -allowed ec2 instance public IP on mongodb server
    -install pm2 on instance
    -*npm install pm2 -g
    -*pm2 start npm --name "devTinder-backend" -- start
    -Commands you can execute in pm2
    -pm2 logs, pm2 list, pm2 flush <processName>, pm2 stop <processName>, pm2 delete <processName>

    FRONTEND : http://http://13.127.24.219
    BACKEND : http://http://13.127.24.219:3007 and we need to map it to http://13.127.24.219/api/

    nginx config : sudo nano /etc/nginx/sites-available/default

    server name : http://13.127.24.219;

    location /api/ {
        proxy_pass http://localhost:3007/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

        🔧 Replace your / block with this:
        location / {
            try_files $uri $uri/ /index.html;
        }
        💡 This line is the magic
        try_files $uri $uri/ /index.html;

        👉 Means:

        If file exists → serve it
        Else → fallback to index.html (React handles route)
        🔁 Then restart Nginx
        sudo nginx -t
        sudo systemctl restart nginx

    after doing it restart nginx : sudo systemctl restart nginx
    -Modify the base url to /api in frontend

    ls: means view all the files.
    cd: to go to that file.
    nano .env : to create file .env
    cat src/app.js : to view contents of app.js
    pm2 logs : all the pm2 logs
    pm2 restart all/log name : restart process

- WE NEED TO ONLY CONFIGURE NGINX ONCE

# BUILDING LIVE CHAT FEATURE USING WEBSOCKETS (SOCKET.IO)
-Build the UI for a chat window/on/chat/:targetUserId
-setup socket.io in backend
-npm i socket.io
-Setup frontend npm i socket.io-client
-Initialise the chat
-createSocketConnection()
-Listen to events
-Homework : improve the UI
-Homework : Fix security bug - auth in web sockets
-Homework : Fix security bug -If i'm not friend , then I should not be able to send messages
-Homework : Show green symbol when online
-Homework : Limit messages fetching from database.
