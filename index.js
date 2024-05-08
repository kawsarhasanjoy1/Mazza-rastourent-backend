const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 5000
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var jwt = require('jsonwebtoken');
const app = express()

// midilwhere
app.use(express.json())
app.use(cors())
app.get('/', (req, res) => {
    res.send('mazza server is running')
})


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.NAME}:${process.env.PASS}@cluster0.epe0s9p.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        const userCollection = client.db("Mazza").collection("user");
        const ProductCollection = client.db("Mazza").collection("product");
        const BookingCollection = client.db("Mazza").collection("booking");
        const paymentCollection = client.db("Mazza").collection("payment");
        const BookCollection = client.db("Mazza").collection("book");
        await client.connect();
        // Send a ping to confirm a successful connection
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            if (!user?.Admin == true) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next()
        }

        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "7d" })
            res.send({ token })
        })

        // payment information
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            if (price) {
                const amount = parseFloat(price) * 100;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    payment_method_types: ['card']
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            }

        });


        // user post and get
        app.post('/user', async (req, res) => {
            const { user } = req.body
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exit' })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/user/admin/:id', async (req, res) => {
            const id = req.params.id;
            const { Admin } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    Admin: Admin,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        app.get('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const result = { Admin: user?.Admin ? user?.Admin : false }
            res.send(result)
        })




        // product post
        app.post('/product', async (req, res) => {
            const { product } = req.body;
            const result = await ProductCollection.insertOne(product)
            res.send(result)
        })

        app.get('/product', async (req, res) => {
            const result = await ProductCollection.find().toArray()
            res.send(result)
        })

        app.get('/product-single/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await ProductCollection.findOne(query)
            res.send(result)
        })

        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await ProductCollection.deleteOne(query);
            res.send(result)
        })
        // app.put('/product/update/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const { product } = req.body;
        //     const filter = { _id: new ObjectId(id) };
        //     const updateDoc = {
        //         $set: {
        //             product: product
        //         },
        //     };
        //     console.log(updateDoc)
        //     const result = await ProductCollection.updateOne(filter, updateDoc);
        //     res.send(result);

        // })

        app.put('/product/update/:id', async (req, res) => {
            const { product } = req.body;
            const id = req.params.id;
            const options = { upsert: true };
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: product
            };
            console.log(updateDoc)
            const result = await ProductCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        app.get('/admin/product', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await ProductCollection.find().toArray()
            res.send(result)
        })


        // booking product 

        app.post('/booking', async (req, res) => {
            const { booking } = req.body
            const result = await BookingCollection.insertOne(booking);
            res.send(result)
        })

        app.get('/booking', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await BookingCollection.find().toArray()
            res.send(result)
        })

        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await BookingCollection.deleteOne(query);
            res.send(result)
        })

        app.patch('/booking/confirmed/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    Confirmed: status,
                },
            };
            const result = await BookingCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.get('/bookingsGet/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await BookingCollection.findOne(query)
            res.send(result)
        })

        app.get('/bookings/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email
            const email = req.params.email;
            if (decodedEmail !== email) {
                res.status(401).send({ error: true, message: 'forbidden access' })
            }
            const query = { 'Guest.email': email }
            const result = await BookingCollection.find(query).toArray()
            res.send(result)
        })

        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await BookingCollection.deleteOne(query);
            res.send(result)
        })


        app.post('/payment', async (req, res) => {
            const { payment } = req.body;
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })

        app.get('/user-payment/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email
            const email = req.params.email
            if (decodedEmail !== email) {
                req.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/admin-payment', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find().toArray()
            res.send(result)
        })

        app.post('/book-table', async (req, res) => {
            const { book } = req.body
            const result = await BookCollection.insertOne(book)
            res.send(result)
        })

        app.get('/book-table/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const decodedEmail = req.decoded.email
            if (decodedEmail !== email) {
                req.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { 'guest.email': email }
            const result = await BookCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/book-table', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await BookCollection.find().toArray()
            res.send(result)
        })

        app.delete('/book-table/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await BookCollection.deleteOne(query);
            res.send(result)
        })

        app.patch('/book-table/confirm/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    Confirmed: status,
                },
            };
            const result = await BookCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`server is runnning on ${port}`)
})