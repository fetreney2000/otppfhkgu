import { useState, useEffect } from 'react';
import { Card, TextInput, PasswordInput, Button, Title, Text, Alert, Center, Stack, Loader, Group, Box } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';

export function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    
    const result = await login(name.trim(), password);
    if (result.success && result.redirectUrl) {
      navigate(result.redirectUrl, { replace: true });
    }
  };

  return (
    <Center style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #103860 0%, #1d4d80 50%, #2d6aad 100%)' }}>
      <Box style={{ width: '100%', maxWidth: 420, padding: 16 }}>
        <Card shadow="lg" padding="xl" radius="lg" withBorder>
          <Stack align="center" mb="lg">
            <Title order={2} style={{ color: '#103860' }}>Jadual OT Bersepadu</Title>
            <Text size="sm" c="dimmed">Sistem Penjanaan Jadual OT Kesihatan</Text>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={clearError} withCloseButton>
                  {error}
                </Alert>
              )}

              <TextInput
                label="Nama Kakitangan"
                placeholder="Masukkan nama anda"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
                size="md"
                disabled={isLoading}
              />

              <PasswordInput
                label="Kata Laluan"
                placeholder="Masukkan kata laluan"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                size="md"
                disabled={isLoading}
              />

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={isLoading}
                leftSection={!isLoading ? <IconLogin size={18} /> : undefined}
                style={{ backgroundColor: '#103860' }}
              >
                Log Masuk
              </Button>

              <Text size="xs" c="dimmed" ta="center" mt="xs">
                Masukkan nama dan kata laluan anda untuk log masuk
              </Text>
            </Stack>
          </form>
        </Card>
      </Box>
    </Center>
  );
}