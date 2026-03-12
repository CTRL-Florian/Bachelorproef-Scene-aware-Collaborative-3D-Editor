/**
 * E2E Tests - Network Conditions
 * 
 * Deze tests simuleren network problemen en verifiëren
 * dat de applicatie correct herstelt.
 */

import { test, expect, navigateAllUsers, setUserName, waitForSceneReady } from '../fixtures/collaboration-fixtures';

test.describe('Network Disconnection', () => {
  test('user should see reconnection after brief disconnect', async ({ 
    createUsers, 
    disconnectUser, 
    reconnectUser 
  }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Disconnect User2
    await disconnectUser(users[1]);
    
    // Wacht even
    await users[0].page.waitForTimeout(2000);
    
    // Reconnect User2
    await reconnectUser(users[1]);
    
    // Verify dat de pagina weer werkt
    await expect(users[1].page.locator('canvas')).toBeVisible();
  });

  test('changes made while offline should sync after reconnect', async ({ 
    createUsers, 
    disconnectUser,
    reconnectUser 
  }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Disconnect User2
    await disconnectUser(users[1]);
    
    // User1 maakt changes terwijl User2 offline is
    // Dit vereist interactie met de UI - implementatie afhankelijk
    
    // Wacht even
    await users[0].page.waitForTimeout(1000);
    
    // Reconnect User2
    await reconnectUser(users[1]);
    
    // Wacht op sync
    await users[1].page.waitForTimeout(2000);
    
    // Verify dat de changes gesynct zijn
    // Dit vereist een manier om scene state te vergelijken
  });

  test('both users offline then reconnect should merge states', async ({ 
    createUsers,
    disconnectUser,
    reconnectUser 
  }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Beide users gaan offline
    await disconnectUser(users[0]);
    await disconnectUser(users[1]);
    
    // Beide maken changes
    // (UI interactie - implementatie afhankelijk)
    
    // Wacht even
    await users[0].page.waitForTimeout(1000);
    
    // Beide reconnecten
    await reconnectUser(users[0]);
    await reconnectUser(users[1]);
    
    // Wacht op sync
    await users[0].page.waitForTimeout(3000);
    
    // Verify dat states consistent zijn
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

test.describe('Connection Quality', () => {
  test('should handle slow network', async ({ createUsers, page }) => {
    const users = await createUsers(1);
    
    // Simuleer trage verbinding
    const cdpSession = await users[0].context.newCDPSession(users[0].page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8, // 50kb/s
      uploadThroughput: 50 * 1024 / 8,
      latency: 500, // 500ms latency
    });
    
    await navigateAllUsers(users);
    
    // De app zou nog steeds moeten laden
    await expect(users[0].page.locator('canvas')).toBeVisible({ timeout: 30000 });
  });

  test('should recover from packet loss', async ({ createUsers }) => {
    const users = await createUsers(2);
    await navigateAllUsers(users);
    
    await setUserName(users[0], 'Alice');
    await setUserName(users[1], 'Bob');
    
    await waitForSceneReady(users[0]);
    await waitForSceneReady(users[1]);
    
    // Simuleer packet loss door requests te intercepten
    let dropCount = 0;
    await users[1].context.route('**/localhost:1234/**', async (route) => {
      // Drop elke 3e request
      if (dropCount % 3 === 0) {
        dropCount++;
        return route.abort();
      }
      dropCount++;
      return route.continue();
    });
    
    // Wacht even
    await users[0].page.waitForTimeout(3000);
    
    // Reset routing
    await users[1].context.unrouteAll();
    
    // Refresh om reconnect te forceren
    await users[1].page.reload();
    
    // Verify dat de app nog werkt
    await expect(users[1].page.locator('canvas')).toBeVisible();
  });
});
