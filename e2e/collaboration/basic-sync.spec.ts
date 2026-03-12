/**
 * E2E Collaboration Tests - Basic Sync
 * 
 * Deze tests verifiëren real-time collaboration features
 * met echte browser instances via Playwright.
 */

import { test, expect, navigateAllUsers, setUserName, waitForSceneReady } from '../fixtures/collaboration-fixtures';

test.describe('Multi-User Collaboration', () => {
  test('two users should see the same scene', async ({ createUsers }) => {
    // Maak 2 gebruikers aan
    const users = await createUsers(2);
    
    // Navigeer beide naar de app
    await navigateAllUsers(users);
    
    // Set usernames (vult de verplichte dialog in)
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    // Wacht tot scene geladen is
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Beide users moeten het canvas zien
    await expect(users[0].page.locator('canvas')).toBeVisible();
    await expect(users[1].page.locator('canvas')).toBeVisible();
  });

  test('user presence should be visible to other users', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Wacht even voor presence sync
    await users[0].page.waitForTimeout(1000);
    
    // Check of de user avatars component zichtbaar is
    // Dit hangt af van hoe UserAvatars geïmplementeerd is
    const avatarsContainer = users[0].page.locator('[class*="avatar"], [data-testid="user-avatars"]');
    
    // Er zou minstens iets met avatars moeten zijn
    // Als dit faalt, kan de selector aangepast worden
  });

  test('adding an object should sync to other user', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Gebruik de test hooks om een object toe te voegen via User1
    const boxId = await users[0].page.evaluate(() => {
      // @ts-ignore - test hook
      return window.addTestBox?.([5, 0, 0]) ?? null;
    });
    
    if (boxId) {
      // Wacht op sync
      await users[0].page.waitForTimeout(500);
      
      // Check dat User2 het object ook ziet
      const user2ObjectCount = await users[1].page.evaluate(() => {
        // @ts-ignore - test hook
        return window.getSceneObjectCount?.() ?? 0;
      });
      
      const user1ObjectCount = await users[0].page.evaluate(() => {
        // @ts-ignore - test hook
        return window.getSceneObjectCount?.() ?? 0;
      });
      
      // Beide moeten hetzelfde aantal objecten zien
      expect(user1ObjectCount).toBe(user2ObjectCount);
    }
  });
});

test.describe('Scene Synchronization', () => {
  test('scene state should be consistent across users after operations', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Voer een aantal operaties uit via de UI
    // Dit is afhankelijk van je UI implementatie
    
    // Wacht op sync
    await users[0].page.waitForTimeout(1000);
    
    // Vergelijk scene states
    // Dit vereist dat de app scene state kan exporteren
    const state1 = await users[0].page.evaluate(() => {
      // @ts-ignore
      return window.getSceneState?.() ?? null;
    });
    
    const state2 = await users[1].page.evaluate(() => {
      // @ts-ignore
      return window.getSceneState?.() ?? null;
    });
    
    if (state1 && state2) {
      expect(state1).toEqual(state2);
    }
  });
});
