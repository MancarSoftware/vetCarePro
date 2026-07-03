const { createHmac, randomUUID } = require('node:crypto');

const LICENSE_PREFIX = 'VCP-LAN-';
const DEFAULT_LICENSE_SECRET =
  'vetcare-pro-lan-license-signing-key-v1-change-before-public-release';

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalStringify(nested)}`)
    .join(',')}}`;
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret)
    .update(canonicalStringify(payload))
    .digest('base64url');
}

function createLicenseKey(payload, secret) {
  const signature = signPayload(payload, secret);
  const encodedPayload = Buffer.from(canonicalStringify(payload), 'utf8').toString(
    'base64url',
  );
  return `${LICENSE_PREFIX}${encodedPayload}.${signature}`;
}

function readArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const clinicName = String(args.clinic ?? '').trim();
  const clientLimit = Number(args.clients ?? args.clientLimit);
  const expiresAt = args.expires ? new Date(String(args.expires)) : null;

  if (!clinicName) {
    throw new Error('Uso: npm run license:generate -- --clinic "Clinica X" --clients 3');
  }

  if (!Number.isInteger(clientLimit) || clientLimit < 1) {
    throw new Error('El numero de PCs cliente debe ser un entero mayor a 0.');
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error('La fecha de vencimiento debe tener formato valido. Ejemplo: 2027-12-31');
  }

  const payload = {
    product: 'VetCare Pro',
    edition: 'LAN',
    licenseId: `VCP-LAN-${randomUUID().slice(0, 8).toUpperCase()}`,
    clinicName,
    clientLimit,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
  const licenseKey = createLicenseKey(
    payload,
    process.env.VETCARE_LICENSE_SECRET ?? DEFAULT_LICENSE_SECRET,
  );

  console.log('');
  console.log('Licencia LAN generada');
  console.log('======================');
  console.log(`Clinica: ${payload.clinicName}`);
  console.log(`PCs cliente permitidas: ${payload.clientLimit}`);
  console.log(`ID licencia: ${payload.licenseId}`);
  console.log('');
  console.log(licenseKey);
  console.log('');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
