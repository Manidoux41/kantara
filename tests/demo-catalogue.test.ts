import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readDemoCatalogue } from "../services/demo/session";
import { FileWorkspaceRepository } from "../services/demo/repository";
import { executeBusinessCommand } from "../services/demo/business";

test("public browsing never allocates CRM workspaces, preserves an existing catalogue and does not hide corrupt storage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kantara-public-map-"));
  const before = { node: process.env.NODE_ENV, directory: process.env.DEMO_DATA_DIR, storage: process.env.DEMO_STORAGE };
  Object.assign(process.env, { NODE_ENV: "development", DEMO_DATA_DIR: directory, DEMO_STORAGE: "file" });
  try {
    const request = (cookie?: string) => new Request("http://localhost:3000/api/demo/catalogue", { headers: cookie ? { cookie } : {} });
    const anonymous = await readDemoCatalogue(request());
    assert.equal(anonymous.state.properties.length, 6);
    assert.equal(anonymous.cookie, undefined);
    assert.deepEqual(await readdir(directory), []);
    const repository = new FileWorkspaceRepository(directory), id = randomUUID();
    await repository.create(id);
    await repository.update(id, (state) => executeBusinessCommand(state, { action: "publish", revision: state.revision, propertyId: "DEMO-001", published: false }));
    const own = await readDemoCatalogue(request(`kantara-demo-workspace=${id}`));
    assert.equal(own.state.properties[0].publication, "DRAFT");
    assert.ok(own.cookie?.includes(id));
    const files = await readdir(directory);
    for (let index = 0; index < 5; index++) await readDemoCatalogue(request());
    assert.deepEqual(await readdir(directory), files);
    await writeFile(join(directory, `${id}.json`), "CORRUPT TEST DATA");
    await assert.rejects(readDemoCatalogue(request(`kantara-demo-workspace=${id}`)), /no data was reset/);
  } finally {
    for (const [key, value] of [["NODE_ENV", before.node], ["DEMO_DATA_DIR", before.directory], ["DEMO_STORAGE", before.storage]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
