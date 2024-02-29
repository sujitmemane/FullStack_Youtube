import app from "./app.js";

import { config } from "dotenv";

import { connectDB } from "./db/index.js";

config({ path: "./.env" });
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8080, () =>
      console.log(`App is Listening on port ${process.env.PORT}`)
    );
  })
  .catch((error) => {
    console.log(`MongoDB Connection Failed ${error}`);
  });
