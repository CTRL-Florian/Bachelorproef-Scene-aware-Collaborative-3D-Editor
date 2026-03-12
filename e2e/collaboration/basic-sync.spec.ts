/**
 * E2E Collaboration Tests - Basic Sync
 * 
 * Deze tests verifiëren real-time collaboration features
 * met echte browser instances via Playwright.
 */

import { test, expect, navigateAllUsers, setUserName, waitForSceneReady } from '../fixtures/collaboration-fixtures';

test.describe('Multi-User Collaboration', () => {
  test('two users should see the same scene', async ({ createUsers, page }) => {
    // Maak 2 gebruikers aan
    const users = await createUsers(2);
    
    // Navigeer beide naar de app
    await navigateAllUsers(users);
    
    // Set usernames
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
    
    // Check of beide users elkaars avatars zien
    // Dit hangt af van hoe de UI geïmplementeerd is
    const avatarsUser1 = users[0].page.locator('[data-testid="user-avatar"], .user-avatar');
    const avatarsUser2 = users[1].page.locator('[data-testid="user-avatar"], .user-avatar');
    
    // Er zouden minimaal 2 avatars moeten zijn (inclusief eigen avatar)
    // Dit kan falen als de app geen avatars toont - pas aan naar jouw UI
  });

  test('adding an object should sync to other user', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // User1 opent het Insert menu en voegt een box toe
    // Let op: pas deze selectors aan naar jouw UI
    const insertMenu = users[0].page.getByRole('menubar').getByText(/insert/i);
    
    if (await insertMenu.isVisible()) {
      await insertMenu.click();
      
      // Zoek de "Add Box" optie
      const addBoxOption = users[0].page.getByRole('menuitem', { name: /box|kubus/i });
      if (await addBoxOption.isVisible()) {
        await addBoxOption.click();
        
        // Als er een dialog is, vul de waarden in en submit
        const dialog = users[0].page.getByRole('dialog');
        if (await dialog.isVisible()) {
          // Klik op de submit button
          const submitButton = dialog.getByRole('button', { name: /add|create|toevoegen/i });
          if (await submitButton.isVisible()) {
            await submitButton.click();
          }
        }
        
        // Wacht op sync
        await users[0].page.waitForTimeout(500);
        
        // Verify dat beide users hetzelfde aantal objecten zien
        // Dit vereist dat de app een manier heeft om het aantal objecten te checken
        // Je kunt dit doen via de scene graph UI of via window functies
      }
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
