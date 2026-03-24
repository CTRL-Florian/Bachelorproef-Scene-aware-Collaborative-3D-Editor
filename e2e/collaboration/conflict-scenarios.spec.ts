/**
 * E2E Collaboration Tests - Conflict Scenarios
 *
 * Deze tests documenteren huidig conflictgedrag in een echte browser/multi-tab setup.
 * Ze forceren conflicten, maar leggen geen oplossingsstrategie op.
 */

import { test, expect, navigateAllUsers, setUserName, waitForSceneReady, resetCameraForAllUsers } from '../fixtures/collaboration-fixtures';

test.describe('Collaboration Conflict Scenarios', () => {
  test('concurrent move updates should converge to same final object state', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);

    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');

    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    await resetCameraForAllUsers(users);

    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([0, 0, 0]) ?? null;
    });

    expect(boxId).not.toBeNull();
    await users[0].page.waitForTimeout(400);

    await Promise.all([
      users[0].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectPosition?.(id, [10, 0, 0]);
      }, boxId),
      users[1].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectPosition?.(id, [0, 10, 0]);
      }, boxId),
    ]);

    await users[0].page.waitForTimeout(600);

    const object1 = await users[0].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    const object2 = await users[1].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    expect(object1).toEqual(object2);
    expect(object1).not.toBeNull();
  });

  test('concurrent color updates should converge to one selected color', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);

    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');

    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    await resetCameraForAllUsers(users);

    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([1, 1, 1]) ?? null;
    });

    expect(boxId).not.toBeNull();
    await users[0].page.waitForTimeout(400);

    await Promise.all([
      users[0].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectColor?.(id, '#FF0000');
      }, boxId),
      users[1].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectColor?.(id, '#0000FF');
      }, boxId),
    ]);

    await users[0].page.waitForTimeout(600);

    const color1 = await users[0].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id)?.color ?? null;
    }, boxId);

    const color2 = await users[1].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id)?.color ?? null;
    }, boxId);

    expect(color1).toBe(color2);
    expect(color1).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('delete vs rotate conflict should converge to same outcome for both users', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);

    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');

    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    await resetCameraForAllUsers(users);

    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([2, 2, 2]) ?? null;
    });

    expect(boxId).not.toBeNull();
    await users[0].page.waitForTimeout(400);

    await Promise.all([
      users[0].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.removeTestObject?.(id);
      }, boxId),
      users[1].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectRotation?.(id, [0, Math.PI / 2, 0]);
      }, boxId),
    ]);

    await users[0].page.waitForTimeout(700);

    const object1 = await users[0].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    const object2 = await users[1].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    expect(object1).toEqual(object2);
  });

  test('concurrent move and rotate should converge to same state', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);

    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');

    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    await resetCameraForAllUsers(users);

    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([0, 0, 0]) ?? null;
    });

    expect(boxId).not.toBeNull();
    await users[0].page.waitForTimeout(400);

    // Alice moves object, Bob rotates it - both at the same time
    await Promise.all([
      users[0].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectPosition?.(id, [5, 5, 0]);
      }, boxId),
      users[1].page.evaluate((id) => {
        // @ts-ignore - test hook
        window.updateTestObjectRotation?.(id, [Math.PI / 4, 0, 0]);
      }, boxId),
    ]);

    await users[0].page.waitForTimeout(700);

    const final1 = await users[0].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    const final2 = await users[1].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    // Both should see the same final state
    expect(final1).toEqual(final2);
    // But one of the operations may be lost due to whole-object replacement
    expect(final1?.position).toBeDefined();
    expect(final1?.rotation).toBeDefined();
  });

  test('burst updates from both users should converge', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);

    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');

    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    await resetCameraForAllUsers(users);

    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([0, 0, 0]) ?? null;
    });

    expect(boxId).not.toBeNull();
    await users[0].page.waitForTimeout(400);

    // Simulate rapid-fire updates from both users
    for (let i = 0; i < 5; i++) {
      await Promise.all([
        users[0].page.evaluate((id, index) => {
          // @ts-ignore - test hook
          window.updateTestObjectPosition?.(id, [index, 0, 0]);
        }, boxId, i),
        users[1].page.evaluate((id, index) => {
          // @ts-ignore - test hook
          window.updateTestObjectPosition?.(id, [0, index, 0]);
        }, boxId, i),
      ]);
      await users[0].page.waitForTimeout(50);
    }

    await users[0].page.waitForTimeout(700);

    const final1 = await users[0].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    const final2 = await users[1].page.evaluate((id) => {
      // @ts-ignore - test hook
      return window.getSceneObjectById?.(id) ?? null;
    }, boxId);

    // Both must see the same final state after rapid updates
    expect(final1).toEqual(final2);
    expect(final1?.position).toBeDefined();
  });
});
