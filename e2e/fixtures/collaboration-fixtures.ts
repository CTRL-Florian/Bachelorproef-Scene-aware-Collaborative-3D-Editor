/**
 * Playwright test fixtures voor multi-user collaboration tests.
 * 
 * Deze module biedt:
 * - CollaborationFixture: Meerdere browser contexts voor multi-user tests
 * - NetworkConditionFixture: Simuleer netwerk problemen
 * - Helpers voor sync verificatie
 */

import { test as base, BrowserContext, Page } from '@playwright/test';

/**
 * Representeert een gebruiker in een collaboration test
 */
export interface CollaborationUser {
  context: BrowserContext;
  page: Page;
  name: string;
}

/**
 * Extended test fixtures voor collaboration tests
 */
export interface CollaborationFixtures {
  /**
   * Maak meerdere gebruikers aan voor collaboration tests
   */
  createUsers: (count: number) => Promise<CollaborationUser[]>;
  
  /**
   * Disconnect een specifieke gebruiker van het netwerk
   */
  disconnectUser: (user: CollaborationUser) => Promise<void>;
  
  /**
   * Reconnect een specifieke gebruiker
   */
  reconnectUser: (user: CollaborationUser) => Promise<void>;
  
  /**
   * Wacht tot alle gebruikers gesynchroniseerd zijn
   */
  waitForSync: (users: CollaborationUser[], timeout?: number) => Promise<void>;
  
  /**
   * Cleanup alle gebruikers
   */
  cleanupUsers: (users: CollaborationUser[]) => Promise<void>;
}

/**
 * Extended Playwright test met collaboration fixtures
 */
export const test = base.extend<CollaborationFixtures>({
  createUsers: async ({ browser }, use) => {
    const createdUsers: CollaborationUser[] = [];
    
    const createUsers = async (count: number): Promise<CollaborationUser[]> => {
      const users: CollaborationUser[] = [];
      
      for (let i = 0; i < count; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const user: CollaborationUser = {
          context,
          page,
          name: `User${i + 1}`,
        };
        
        users.push(user);
        createdUsers.push(user);
      }
      
      return users;
    };
    
    await use(createUsers);
    
    // Cleanup na de test
    for (const user of createdUsers) {
      await user.context.close();
    }
  },
  
  disconnectUser: async ({}, use) => {
    const disconnectUser = async (user: CollaborationUser): Promise<void> => {
      // Simuleer offline door de WebSocket connectie te blokkeren
      await user.context.route('**/ws://**', route => route.abort());
      await user.context.route('**/wss://**', route => route.abort());
      
      // Extra: blokkeer ook HTTP requests naar de server
      await user.context.route('**/localhost:1234/**', route => route.abort());
    };
    
    await use(disconnectUser);
  },
  
  reconnectUser: async ({}, use) => {
    const reconnectUser = async (user: CollaborationUser): Promise<void> => {
      // Verwijder alle route blocks
      await user.context.unrouteAll();
      
      // Refresh de pagina om reconnect te triggeren
      await user.page.reload();
      
      // Wacht tot de pagina geladen is
      await user.page.waitForLoadState('networkidle');
    };
    
    await use(reconnectUser);
  },
  
  waitForSync: async ({}, use) => {
    const waitForSync = async (
      users: CollaborationUser[], 
      timeout: number = 5000
    ): Promise<void> => {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        // Haal de object counts op van alle users
        const counts = await Promise.all(
          users.map(async (user) => {
            return user.page.evaluate(() => {
              // @ts-ignore - window.getSceneObjectCount wordt toegevoegd door de app voor testing
              return window.getSceneObjectCount?.() ?? -1;
            });
          })
        );
        
        // Check of alle counts gelijk zijn
        if (counts.every((c: number, _: number, arr: number[]) => c === arr[0] && c !== -1)) {
          return;
        }
        
        // Wacht een beetje voor de volgende check
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      throw new Error(`Sync timeout after ${timeout}ms`);
    };
    
    await use(waitForSync);
  },
  
  cleanupUsers: async ({}, use) => {
    const cleanupUsers = async (users: CollaborationUser[]): Promise<void> => {
      for (const user of users) {
        await user.page.close();
        await user.context.close();
      }
    };
    
    await use(cleanupUsers);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper: Voer een actie uit als een specifieke gebruiker
 */
export async function asUser<T>(
  user: CollaborationUser,
  action: (page: Page) => Promise<T>
): Promise<T> {
  return action(user.page);
}

/**
 * Helper: Navigeer alle users naar de app
 */
export async function navigateAllUsers(
  users: CollaborationUser[],
  url: string = '/'
): Promise<void> {
  await Promise.all(
    users.map(user => user.page.goto(url))
  );
  
  // Wacht tot alle paginas geladen zijn
  await Promise.all(
    users.map(user => user.page.waitForLoadState('networkidle'))
  );
}

/**
 * Helper: Set username voor een user in de app
 */
export async function setUserName(
  user: CollaborationUser,
  name: string
): Promise<void> {
  // Wacht op de username dialog
  const dialog = user.page.getByRole('dialog');
  
  if (await dialog.isVisible()) {
    await user.page.getByPlaceholder(/name|naam/i).fill(name);
    await user.page.getByRole('button', { name: /continue|doorgaan|ok/i }).click();
    
    // Wacht tot dialog verdwijnt
    await dialog.waitFor({ state: 'hidden' });
  }
}

/**
 * Helper: Wacht tot scene geladen is
 */
export async function waitForSceneReady(user: CollaborationUser): Promise<void> {
  // Wacht tot het canvas element beschikbaar is
  await user.page.waitForSelector('canvas', { timeout: 10000 });
  
  // Wacht op initiële sync
  await user.page.waitForFunction(
    () => {
      // @ts-ignore
      return window.isSceneReady?.() ?? false;
    },
    { timeout: 10000 }
  ).catch(() => {
    // Fallback: gewoon wachten
    return user.page.waitForTimeout(2000);
  });
}
