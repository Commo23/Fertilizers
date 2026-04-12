/**
 * Minimal `Deno` typings for Supabase Edge Functions when the workspace uses
 * the Vite/React tsconfig (no Deno LSP). Deploy still runs on Deno.
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
