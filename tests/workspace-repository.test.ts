import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, writeFile, rm, stat, open } from "node:fs/promises";
import { FileWorkspaceRepository } from "../services/demo/repository";
import { executeBusinessCommand } from "../services/demo/business";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("file repository survives recreation, atomically saves revisions and never overwrites stale commands", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-test-"));
  try {
    const id = randomUUID(), repository = new FileWorkspaceRepository(directory);
    const initial = await repository.create(id);
    const changed = await repository.update(id, (state) => executeBusinessCommand(state, { action: "publish", revision: state.revision, propertyId: "DEMO-001", published: false }));
    assert.equal(initial.revision, 0);
    assert.equal(changed.revision, 1);
    const reopened = new FileWorkspaceRepository(directory);
    assert.deepEqual(await reopened.read(id), changed);
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--import", "tsx", "--conditions=react-server", "--input-type=module", "-e",
      `import { FileWorkspaceRepository } from "./services/demo/repository.ts"; const state = await new FileWorkspaceRepository(${JSON.stringify(directory)}).read(${JSON.stringify(id)}); console.log(JSON.stringify({revision: state.revision, publication: state.properties[0].publication}));`,
    ]);
    assert.deepEqual(JSON.parse(stdout.trim()), { revision: 1, publication: "DRAFT" });
    assert.equal((await stat(join(directory, `${id}.json`))).mode & 0o777, 0o600);
    await assert.rejects(reopened.update(id, (state) => executeBusinessCommand(state, { action: "publish", revision: 0, propertyId: "DEMO-001", published: true })), /workspace changed/);
    assert.deepEqual(await reopened.read(id), changed);
    assert.equal(await reopened.read(randomUUID()), null);
    await assert.rejects(reopened.read("../../private"), /Invalid workspace/);
    assert.equal(JSON.parse(await readFile(join(directory, `${id}.json`), "utf8")).version, 1);
  } finally { await rm(directory, { recursive: true }); }
});
test("corrupt files and concurrent locks explicitly fail without resetting or overwriting data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-test-"));
  try {
    const id = randomUUID(), repository = new FileWorkspaceRepository(directory);
    await repository.create(id);
    const lockPath = join(directory, `${id}.json.lock`);
    const lock = await open(lockPath, "wx");
    try { await assert.rejects(repository.update(id, (state) => state), /write is in progress/); }
    finally { await lock.close(); await rm(lockPath); }
    const path = join(directory, `${id}.json`);
    await writeFile(path, "CORRUPT TEST");
    await assert.rejects(repository.read(id), /no data was reset/);
    assert.equal(await readFile(path, "utf8"), "CORRUPT TEST");
  } finally { await rm(directory, { recursive: true }); }
});
test("workspace capacity is enforced without preventing updates of existing records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-test-"));
  try {
    const repository = new FileWorkspaceRepository(directory), ids: string[] = [];
    for (let index = 0; index < 50; index++) {
      const id = randomUUID(); ids.push(id); await repository.create(id);
    }
    await assert.rejects(repository.create(randomUUID()), /capacity reached/);
    const saved = await repository.update(ids[0], (state) => executeBusinessCommand(state, {
      action: "publish", revision: state.revision, propertyId: "DEMO-001", published: false,
    }));
    assert.equal(saved.revision, 1);
    assert.equal((await repository.read(ids[0]))?.properties[0].publication, "DRAFT");
  } finally { await rm(directory, { recursive: true }); }
});
