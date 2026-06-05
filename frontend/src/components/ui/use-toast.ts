// Placeholder for shadcn/ui use-toast hook
// To install the real one, run: npx shadcn-ui@latest add toast
export const useToast = () => {
  return {
    toast: (options: { title: string; description: string }) => {
      console.log("Mock Toast:", options.title, options.description);
    },
  };
};
