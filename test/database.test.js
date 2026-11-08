import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const hash = "$2b$12$" + "A".repeat(53); // synthetic format fixture, not a real password
const user = async (email) =>
  (
    await db.query(
      "INSERT INTO app_user(email,password_hash,display_name) VALUES ($1,$2,$3) RETURNING id",
      [email, hash, "테스터"],
    )
  ).rows[0].id;
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../db/migrations/V001__core.sql", import.meta.url),
      "utf8",
    ),
  );
});
after(async () => {
  await db.close();
});
test("migration creates core tables and case-insensitive email uniqueness", async () => {
  await user("Alice@example.com");
  await assert.rejects(
    user("alice@example.com"),
    (error) => error.code === "23505",
  );
  await assert.rejects(
    db.query(
      "INSERT INTO app_user(email,password_hash,display_name) VALUES ($1,$2,$3)",
      ["other@example.com", "plaintext", "tester"],
    ),
    (error) => error.code === "23514",
  );
});
test("review requires existing user/hospital, rating range and one review per user", async () => {
  const id = await user("review@example.com");
  const hospital = (
    await db.query(
      "INSERT INTO hospital(provider,provider_id,name,address,source_checked_at) VALUES ('fixture','h1','가상 병원','가상 주소',now()) RETURNING id",
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "INSERT INTO review(hospital_id,author_id,rating,body) VALUES ($1,$2,6,$3)",
      [hospital, id, "test"],
    ),
    (error) => error.code === "23514",
  );
  await db.query(
    "INSERT INTO review(hospital_id,author_id,rating,body) VALUES ($1,$2,5,$3)",
    [hospital, id, "test"],
  );
  await assert.rejects(
    db.query(
      "INSERT INTO review(hospital_id,author_id,rating,body) VALUES ($1,$2,4,$3)",
      [hospital, id, "test"],
    ),
    (error) => error.code === "23505",
  );
  await assert.rejects(
    db.query("DELETE FROM app_user WHERE id=$1", [id]),
    (error) => error.code === "23503",
  );
});
test("report must have exactly one existing target and terminal timestamp", async () => {
  const id = await user("report@example.com");
  const post = (
    await db.query(
      "INSERT INTO post(author_id,title,body) VALUES ($1,'제목','내용') RETURNING id",
      [id],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query("INSERT INTO report(reporter_id,reason) VALUES ($1,'신고')", [id]),
    (error) => error.code === "23514",
  );
  await assert.rejects(
    db.query(
      "INSERT INTO report(reporter_id,post_id,reason,status) VALUES ($1,$2,'신고','RESOLVED')",
      [id, post],
    ),
    (error) => error.code === "23514",
  );
  await db.query(
    "INSERT INTO report(reporter_id,post_id,reason) VALUES ($1,$2,'신고')",
    [id, post],
  );
  await assert.rejects(
    db.query(
      "INSERT INTO report(reporter_id,post_id,reason) VALUES ($1,$2,'중복')",
      [id, post],
    ),
    (error) => error.code === "23505",
  );
});
test("transaction rollback leaves no partially created account", async () => {
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO app_user(email,password_hash,display_name) VALUES ($1,$2,$3)",
        ["rollback@example.com", hash, "test"],
      );
      throw new Error("abort");
    }),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM app_user WHERE email='rollback@example.com'",
      )
    ).rows[0].count,
    0,
  );
});
