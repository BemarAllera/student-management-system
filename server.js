const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Use a new database file to avoid conflicts with the old grading database
const db = new sqlite3.Database(
  path.join(__dirname, "student_management.sqlite")
);

// Database helpers
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

// Create students table
db.run(
  `CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    year_level TEXT NOT NULL
  )`,
  (error) => {
    if (error) {
      console.error("Database error:", error.message);
      process.exit(1);
    }

    console.log("Database connected successfully.");

    // GET ALL STUDENTS
    app.get("/api/students", async (req, res) => {
      try {
        const students = await all(
          "SELECT * FROM students ORDER BY id DESC"
        );
        res.json(students);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET ONE STUDENT
    app.get("/api/students/:id", async (req, res) => {
      try {
        const student = await get(
          "SELECT * FROM students WHERE id = ?",
          [req.params.id]
        );

        if (!student) {
          return res.status(404).json({ error: "Student not found." });
        }

        res.json(student);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ADD STUDENT
    app.post("/api/students", async (req, res) => {
      try {
        const { name, course, year_level } = req.body;

        if (
          !name?.trim() ||
          !course?.trim() ||
          !year_level?.trim()
        ) {
          return res.status(400).json({
            error: "Please complete all student fields."
          });
        }

        const result = await run(
          `INSERT INTO students (name, course, year_level)
           VALUES (?, ?, ?)`,
          [name.trim(), course.trim(), year_level.trim()]
        );

        const student = await get(
          "SELECT * FROM students WHERE id = ?",
          [result.id]
        );

        res.status(201).json(student);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // UPDATE STUDENT
    app.put("/api/students/:id", async (req, res) => {
      try {
        const { name, course, year_level } = req.body;

        if (
          !name?.trim() ||
          !course?.trim() ||
          !year_level?.trim()
        ) {
          return res.status(400).json({
            error: "Please complete all student fields."
          });
        }

        const result = await run(
          `UPDATE students
           SET name = ?, course = ?, year_level = ?
           WHERE id = ?`,
          [
            name.trim(),
            course.trim(),
            year_level.trim(),
            req.params.id
          ]
        );

        if (result.changes === 0) {
          return res.status(404).json({ error: "Student not found." });
        }

        const student = await get(
          "SELECT * FROM students WHERE id = ?",
          [req.params.id]
        );

        res.json(student);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // DELETE STUDENT
    app.delete("/api/students/:id", async (req, res) => {
      try {
        const result = await run(
          "DELETE FROM students WHERE id = ?",
          [req.params.id]
        );

        if (result.changes === 0) {
          return res.status(404).json({ error: "Student not found." });
        }

        res.json({ message: "Student deleted successfully." });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API 404 RESPONSE
    app.use("/api", (req, res) => {
      res.status(404).json({ error: "API route not found." });
    });

    // Start server
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Server running at http://127.0.0.1:${PORT}`);
    });
  }
);