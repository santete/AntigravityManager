import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ipc } from '@/ipc/manager';
import { AppConfig } from '@/types/config';
import { toast } from '@/components/ui/use-toast';

export function useAppConfig() {
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['appConfig'],
    queryFn: async () => {
      return (await ipc.client.config.load()) as AppConfig;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: AppConfig) => {
      await ipc.client.config.save(newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      toast({
        title: 'Settings saved',
        description: 'Your configuration has been updated.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Error saving settings',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return {
    config,
    isLoading,
    error,
    saveConfig: updateConfig.mutateAsync,
    isSaving: updateConfig.isPending,
  };
}
