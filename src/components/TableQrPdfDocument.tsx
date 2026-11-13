import React from 'react';
import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { Merchant, TableSession } from '@/types/schema';

export interface TableWithQrDataUrl extends TableSession {
  qrPngDataUrl: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 10,
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1D1D1F',
  },
  headerSub: {
    fontSize: 9,
    color: '#86868B',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: '#1D1D1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    alignItems: 'center',
    backgroundColor: '#FAFAFC',
  },
  merchantName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1D1D1F',
    textAlign: 'center',
    marginBottom: 2,
  },
  subdomainText: {
    fontSize: 8,
    color: '#0071E3',
    marginBottom: 10,
  },
  qrFrame: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 10,
  },
  qrImg: {
    width: 145,
    height: 145,
  },
  tableBadge: {
    backgroundColor: '#1D1D1F',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 99,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0071E3',
    marginBottom: 8,
    textAlign: 'center',
  },
  wifiBox: {
    width: '100%',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 7,
    alignItems: 'center',
  },
  wifiLabel: {
    fontSize: 7.5,
    color: '#86868B',
    marginBottom: 2,
  },
  wifiCreds: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1D1D1F',
  },
});

export function TableQrPdfDocument({
  merchant,
  tables,
  pageSize = 'A4',
}: {
  merchant: Merchant;
  tables: TableWithQrDataUrl[];
  pageSize?: 'A4' | 'A5';
}) {
  // Chunk into 4 cards per A4 page or 1 card per A5 tent
  const perPage = pageSize === 'A5' ? 1 : 4;
  const pages: TableWithQrDataUrl[][] = [];
  for (let i = 0; i < tables.length; i += perPage) {
    pages.push(tables.slice(i, i + perPage));
  }

  return (
    <Document title={`${merchant.name} - Printable Table QR`}>
      {pages.map((chunk, pageIdx) => (
        <Page key={pageIdx} size={pageSize} style={styles.page}>
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>{merchant.name}</Text>
            <Text style={styles.headerSub}>
              Saber F&B Direct Commerce • {pageSize} Print Sheet ({pageIdx + 1}/{pages.length})
            </Text>
          </View>

          <View style={styles.grid}>
            {chunk.map((tbl) => (
              <View
                key={tbl.id}
                style={[
                  styles.card,
                  pageSize === 'A5' ? { width: '100%', padding: 24, marginTop: 12 } : {},
                ]}
              >
                <Text style={styles.merchantName}>{merchant.name}</Text>
                <Text style={styles.subdomainText}>
                  {tbl.qrCodeUrl.split('?')[0]}
                </Text>

                <View style={styles.qrFrame}>
                  <PdfImage src={tbl.qrPngDataUrl} style={styles.qrImg} />
                </View>

                <Text style={styles.tableBadge}>{tbl.tableNumber}</Text>
                <Text style={styles.ctaText}>Scan to View Menu & Order</Text>

                <View style={styles.wifiBox}>
                  <Text style={styles.wifiLabel}>FREE GUEST WIFI</Text>
                  <Text style={styles.wifiCreds}>
                    SSID: {tbl.wifiName || 'KopiNusantara_5G'} • Pass:{' '}
                    {tbl.wifiPassword || 'kopi100persen'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}

