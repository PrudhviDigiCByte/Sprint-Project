const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "Database.db");
const port = 3000;

let db;

const intalizeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(port, () => {
      console.log(`Server Running on ${port}`);
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

intalizeDbServer();

app.get("/", async (req, res) => {
  const query = `select * from users;`;
  const result = await db.all(query);
  res.send(result);
});

// Enable JSON parsing middleware

// Create user endpoint
app.post("/create_user", async (req, res) => {
  try {
    const { full_name, mob_num, pan_num, manager_id } = req.body;

    // Validation: full_name must not be empty
    if (!full_name || full_name.trim() === "") {
      return res.status(400).json({ error: "Full name is required" });
    }

    // Validation: mobile number
    let formattedMobNum = mob_num;
    // Remove any prefix like +91 or 0
    if (mob_num.startsWith("+91")) {
      formattedMobNum = mob_num.substring(3);
    } else if (mob_num.startsWith("0")) {
      formattedMobNum = mob_num.substring(1);
    }

    // Check if mobile number is valid (10 digits)
    const mobNumRegex = /^\d{10}$/;
    if (!mobNumRegex.test(formattedMobNum)) {
      return res.status(400).json({ error: "Invalid mobile number format" });
    }

    // Validation: PAN number (ABCDE1234F format)
    const formattedPanNum = pan_num.toUpperCase();
    const panNumRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panNumRegex.test(formattedPanNum)) {
      return res.status(400).json({ error: "Invalid PAN number format" });
    }

    // Validation: Check if manager exists and is active
    const managerQuery = `SELECT * FROM managers WHERE manager_id = ? AND is_active = 1`;
    const manager = await db.get(managerQuery, [manager_id]);

    if (!manager) {
      return res.status(400).json({ error: "Manager not found or not active" });
    }

    // Generate a UUID for the new user
    const { v4: uuidv4 } = require("uuid");
    const userId = uuidv4();

    // Insert the new user into the database
    const insertQuery = `
      INSERT INTO users (user_id, full_name, mob_num, pan_num, manager_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

    await db.run(insertQuery, [
      userId,
      full_name,
      formattedMobNum,
      formattedPanNum,
      manager_id,
    ]);

    res.status(201).json({
      id: userId,
      full_name,
      mobile_number: formattedMobNum,
      pan_number: formattedPanNum,
      manager_id,
      message: "User created successfully",
    });
  } catch (error) {
    console.error(`Error creating user: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

//2

// Get users endpoint with optional filtering
app.post("/get_users", async (req, res) => {
  try {
    const { user_id, mob_num, manager_id } = req.body;

    // Start building the query
    let query = "SELECT * FROM users WHERE 1=1";
    const params = [];

    // Add filters based on what was provided
    if (user_id) {
      query += " AND user_id = ?";
      params.push(user_id);
    }

    if (mob_num) {
      // Format mobile number similar to create_user logic
      let formattedMobNum = mob_num;
      if (mob_num.startsWith("+91")) {
        formattedMobNum = mob_num.substring(3);
      } else if (mob_num.startsWith("0")) {
        formattedMobNum = mob_num.substring(1);
      }

      query += " AND mob_num = ?";
      params.push(formattedMobNum);
    }

    if (manager_id) {
      query += " AND manager_id = ?";
      params.push(manager_id);
    }

    // Add a clause to only return active users
    query += " AND is_active = 1";

    // Execute the query
    const users = await db.all(query, params);

    // Return the results, empty array if none found
    res.status(200).json({ users });
  } catch (error) {
    console.error(`Error fetching users: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

//3

// Delete user endpoint
app.post("/delete_user", async (req, res) => {
  try {
    const { user_id, mob_num } = req.body;

    // Validate that at least one identifier is provided
    if (!user_id && !mob_num) {
      return res
        .status(400)
        .json({ error: "Either user_id or mob_num must be provided" });
    }

    let query = "";
    let params = [];

    // Build query based on provided parameters
    if (user_id) {
      query =
        "UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?";
      params = [user_id];
    } else {
      // Format mobile number if provided
      let formattedMobNum = mob_num;
      if (mob_num.startsWith("+91")) {
        formattedMobNum = mob_num.substring(3);
      } else if (mob_num.startsWith("0")) {
        formattedMobNum = mob_num.substring(1);
      }

      query =
        "UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE mob_num = ?";
      params = [formattedMobNum];
    }

    // Execute the query (soft delete by setting is_active to 0)
    const result = await db.run(query, params);

    // Check if any rows were affected
    if (result.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return success message
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(`Error deleting user: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

//4

// Update user endpoint
app.post("/update_user", async (req, res) => {
  try {
    const { user_ids, update_data } = req.body;

    // Validate required fields
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one user_id must be provided" });
    }

    if (!update_data || Object.keys(update_data).length === 0) {
      return res.status(400).json({ error: "Update data must be provided" });
    }

    // Start a transaction to ensure data consistency
    await db.run("BEGIN TRANSACTION");

    // Check if only manager_id is being updated (bulk update case)
    const isOnlyManagerUpdate =
      Object.keys(update_data).length === 1 &&
      update_data.hasOwnProperty("manager_id");

    // For bulk manager update
    if (isOnlyManagerUpdate && user_ids.length > 1) {
      const { manager_id } = update_data;

      // Validate manager exists and is active
      const managerQuery = `SELECT * FROM managers WHERE manager_id = ? AND is_active = 1`;
      const manager = await db.get(managerQuery, [manager_id]);

      if (!manager) {
        await db.run("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Manager not found or not active" });
      }

      // Update all users' manager_id
      for (const user_id of user_ids) {
        // Check if user exists
        const userQuery = `SELECT * FROM users WHERE user_id = ? AND is_active = 1`;
        const user = await db.get(userQuery, [user_id]);

        if (!user) {
          await db.run("ROLLBACK");
          return res
            .status(404)
            .json({ error: `User with ID ${user_id} not found` });
        }

        // Mark existing record as inactive
        await db.run(
          `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE user_id = ? AND is_active = 1`,
          [user_id]
        );

        // Create new record with updated manager_id
        await db.run(
          `INSERT INTO users (user_id, full_name, mob_num, pan_num, manager_id, created_at, updated_at, is_active)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
          [
            user_id,
            user.full_name,
            user.mob_num,
            user.pan_num,
            manager_id,
            user.created_at,
          ]
        );
      }

      await db.run("COMMIT");
      return res
        .status(200)
        .json({ message: "Bulk manager update successful" });
    }

    // For individual user updates
    if (user_ids.length === 1) {
      const user_id = user_ids[0];

      // Check if user exists
      const userQuery = `SELECT * FROM users WHERE user_id = ? AND is_active = 1`;
      const user = await db.get(userQuery, [user_id]);

      if (!user) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      // Initialize update values with existing data
      let updatedFullName = user.full_name;
      let updatedMobNum = user.mob_num;
      let updatedPanNum = user.pan_num;
      let updatedManagerId = user.manager_id;
      let requireNewRecord = false;

      // Process and validate full_name if provided
      if (update_data.hasOwnProperty("full_name")) {
        const { full_name } = update_data;
        if (!full_name || full_name.trim() === "") {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: "Full name is required" });
        }
        updatedFullName = full_name;
      }

      // Process and validate mob_num if provided
      if (update_data.hasOwnProperty("mob_num")) {
        let formattedMobNum = update_data.mob_num;

        // Remove any prefix like +91 or 0
        if (formattedMobNum.startsWith("+91")) {
          formattedMobNum = formattedMobNum.substring(3);
        } else if (formattedMobNum.startsWith("0")) {
          formattedMobNum = formattedMobNum.substring(1);
        }

        // Check if mobile number is valid (10 digits)
        const mobNumRegex = /^\d{10}$/;
        if (!mobNumRegex.test(formattedMobNum)) {
          await db.run("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Invalid mobile number format" });
        }

        updatedMobNum = formattedMobNum;
      }

      // Process and validate pan_num if provided
      if (update_data.hasOwnProperty("pan_num")) {
        const formattedPanNum = update_data.pan_num.toUpperCase();
        const panNumRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

        if (!panNumRegex.test(formattedPanNum)) {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: "Invalid PAN number format" });
        }

        updatedPanNum = formattedPanNum;
      }

      // Process and validate manager_id if provided
      if (update_data.hasOwnProperty("manager_id")) {
        const { manager_id } = update_data;

        // Validate manager exists and is active
        const managerQuery = `SELECT * FROM managers WHERE manager_id = ? AND is_active = 1`;
        const manager = await db.get(managerQuery, [manager_id]);

        if (!manager) {
          await db.run("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Manager not found or not active" });
        }

        updatedManagerId = manager_id;
        requireNewRecord = true;
      }

      // Update user record
      if (requireNewRecord) {
        // Mark existing record as inactive
        await db.run(
          `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE user_id = ? AND is_active = 1`,
          [user_id]
        );

        // Create new record with updated values
        await db.run(
          `INSERT INTO users (user_id, full_name, mob_num, pan_num, manager_id, created_at, updated_at, is_active)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
          [
            user_id,
            updatedFullName,
            updatedMobNum,
            updatedPanNum,
            updatedManagerId,
            user.created_at,
          ]
        );
      } else {
        // Just update the existing record
        await db.run(
          `UPDATE users SET 
             full_name = ?, 
             mob_num = ?, 
             pan_num = ?, 
             updated_at = datetime('now') 
             WHERE user_id = ? AND is_active = 1`,
          [updatedFullName, updatedMobNum, updatedPanNum, user_id]
        );
      }

      await db.run("COMMIT");
      return res.status(200).json({ message: "User updated successfully" });
    } else {
      // Multiple users but not just manager update - not allowed
      await db.run("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Bulk update is only supported for manager_id" });
    }
  } catch (error) {
    // Make sure to rollback transaction on error
    try {
      await db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error(`Rollback error: ${rollbackError.message}`);
    }

    console.error(`Error updating user: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add an error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});
