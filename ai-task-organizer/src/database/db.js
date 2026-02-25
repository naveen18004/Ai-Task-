import * as SQLite from "expo-sqlite";

let db = null;

function initDB() {
  db = SQLite.openDatabase("tasks.db");

  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT,
        time TEXT,
        priority TEXT,
        category TEXT
      );`
    );
  });
}

function insertTask(task) {
  if (!db) return;

  const { title, date, time, priority, category } = task;

  db.transaction(tx => {
    tx.executeSql(
      `INSERT INTO tasks (title, date, time, priority, category)
       VALUES (?, ?, ?, ?, ?);`,
      [title, date, time, priority, category]
    );
  });
}

function fetchTasks() {
  return new Promise((resolve) => {
    if (!db) {
      resolve([]);
      return;
    }

    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM tasks ORDER BY id DESC;`,
        [],
        (_, result) => resolve(result.rows._array)
      );
    });
  });
}

export { initDB, insertTask, fetchTasks };
