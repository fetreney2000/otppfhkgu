import { Card, Title, Stack, Text, Tabs, List, Code, Anchor, Divider } from '@mantine/core';

export function HelpPage() {
  return (
    <Stack gap="lg">
      <Title order={2}>Bantuan</Title>

      <Tabs defaultValue="admin">
        <Tabs.List>
          <Tabs.Tab value="admin">Panduan Admin</Tabs.Tab>
          <Tabs.Tab value="employee">Panduan Kakitangan</Tabs.Tab>
          <Tabs.Tab value="about">Tentang</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="admin" pt="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack>
              <Title order={3}>Panduan Pentadbir</Title>
              <Divider />
              <Title order={5}>1. Mengurus Kakitangan</Title>
              <Text>Pergi ke halaman "Kakitangan" untuk menambah, mengemaskini, atau memadam rekod kakitangan. Setiap kakitangan memerlukan ID unik, nama, unit (IPP/OPD), jawatan (PPF/PRA), e-mel, gaji, dan kata laluan.</Text>
              
              <Title order={5}>2. Cuti Umum</Title>
              <Text>Tambah cuti umum sebelum menjana jadual. Cuti umum mempengaruhi klasifikasi hari dan pengiraan jam AE.</Text>
              
              <Title order={5}>3. Tugasan AE</Title>
              <Text>Tetapkan unit (IPP/OPD) untuk setiap hari AE. Klik pada tarikh dalam kalendar untuk menetapkan tugasan.</Text>
              
              <Title order={5}>4. Pra-pilihan</Title>
              <Text>Pra-pilihan membolehkan anda menetapkan kakitangan tertentu ke slot tertentu sebelum penjanaan. Pra-pilihan akan dikunci semasa penjanaan.</Text>
              
              <Title order={5}>5. Menjana Jadual</Title>
              <Text>Pergi ke "Jana Jadual" dan klik "Jana Jadual OT". Proses penjanaan berlaku pada pelayar anda menggunakan Web Worker. Proses ini mungkin mengambil masa 1-2 minit. Selepas jana, simpan jadual ke pangkalan data secara automatik.</Text>
              
              <Title order={5}>6. Laporan</Title>
              <Text>View laporan dengan tab Kalendar, Ringkasan, Bayaran, Log, dan Tidak Diisi. Tukar antara jadual Asal dan Salinan menggunakan kawalan segmen.</Text>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="employee" pt="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack>
              <Title order={3}>Panduan Kakitangan</Title>
              <Divider />
              <Title order={5}>1. Jadual Saya</Title>
              <Text>Lihat tugasan OT anda untuk bulan semasa. Setiap kad menunjukkan tarikh, jenis slot, unit, dan jam.</Text>
              
              <Title order={5}>2. Ketidakhadiran</Title>
              <Text>Tandakan tarikh anda tidak tersedia untuk OT. Hantarkan sebelum tarikh potongan yang ditetapkan oleh admin.</Text>
              
              <Title order={5}>3. Laporan</Title>
              <Text>Lihat ringkasan jadual dan bayaran OT bulanan. Hanya jadual salinan boleh dilihat oleh kakitangan.</Text>
              
              <Title order={5}>4. Carta</Title>
              <Text>Lihat carta agihan jam OT, taburan slot, dan peruntukan tahunan.</Text>
              
              <Title order={5}>5. Profil</Title>
              <Text>Kemaskini maklumat profil anda termasuk nama, e-mel, unit, dan gaji.</Text>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="about" pt="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack>
              <Title order={3}>Jadual OT Bersepadu</Title>
              <Text>Sistem Penjanaan dan Pengurusan Jadual OT Kesihatan untuk hospital Malaysia.</Text>
              <Divider />
              <Title order={5}>Teknologi</Title>
              <List>
                <List.Item>React 18 + TypeScript + Vite</List.Item>
                <List.Item>Mantine v9 (UI)</List.Item>
                <List.Item>Zustand (State Management)</List.Item>
                <List.Item>Express.js + MongoDB (Backend)</List.Item>
                <List.Item>Web Worker (Roster Solver)</List.Item>
                <List.Item>PWA (Progressive Web App)</List.Item>
              </List>
              <Divider />
              <Title order={5}>Hak Cipta</Title>
              <Text size="sm" c="dimmed">© 2024 Jadual OT Bersepadu. Semua hak cipta terpelihara.</Text>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}