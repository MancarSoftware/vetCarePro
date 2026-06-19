import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AppointmentStatus,
  AppointmentType,
  AuditAction,
  BackupStatus,
  InventoryMovementType,
  MediaCategory,
  MedicalRecordType,
  PaymentItemType,
  PaymentMethod,
  PaymentStatus,
  PetSex,
  PetStatus,
  PreventiveCareStatus,
  PrismaClient,
  TreatmentEvolutionStatus,
  TreatmentStatus,
  UserStatus,
} from '../src/generated/prisma/client';

const defaultDatabaseUrl =
  'postgresql://vetcare:vetcare_dev@127.0.0.1:54329/vetcare_pro?schema=public';
const connectionString = process.env.DATABASE_URL ?? defaultDatabaseUrl;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const demoOwnerPrefix = 'DEMO-';
const demoEmailDomain = '@vetcare.demo';
const demoUploadsPath = 'C:\\VetCarePro\\uploads\\demo';
const demoBackupsPath = 'C:\\VetCarePro\\backups\\demo';

const permissions = {
  DASHBOARD_READ: 'dashboard.read',
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  OWNERS_READ: 'owners.read',
  OWNERS_MANAGE: 'owners.manage',
  PETS_READ: 'pets.read',
  PETS_MANAGE: 'pets.manage',
  APPOINTMENTS_READ: 'appointments.read',
  APPOINTMENTS_MANAGE: 'appointments.manage',
  MEDICAL_READ: 'medical.read',
  MEDICAL_MANAGE: 'medical.manage',
  VACCINES_READ: 'vaccines.read',
  VACCINES_MANAGE: 'vaccines.manage',
  TREATMENTS_READ: 'treatments.read',
  TREATMENTS_MANAGE: 'treatments.manage',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_MANAGE: 'inventory.manage',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_MANAGE: 'payments.manage',
  REPORTS_READ: 'reports.read',
  SETTINGS_MANAGE: 'settings.manage',
  BACKUPS_MANAGE: 'backups.manage',
  AUDIT_READ: 'audit.read',
} as const;

const permissionDescriptions: Record<string, string> = {
  [permissions.DASHBOARD_READ]: 'Ver el dashboard',
  [permissions.USERS_READ]: 'Ver usuarios y roles',
  [permissions.USERS_MANAGE]: 'Crear y administrar usuarios',
  [permissions.OWNERS_READ]: 'Ver duenos',
  [permissions.OWNERS_MANAGE]: 'Administrar duenos',
  [permissions.PETS_READ]: 'Ver mascotas',
  [permissions.PETS_MANAGE]: 'Administrar mascotas',
  [permissions.APPOINTMENTS_READ]: 'Ver citas',
  [permissions.APPOINTMENTS_MANAGE]: 'Administrar citas',
  [permissions.MEDICAL_READ]: 'Ver historiales clinicos',
  [permissions.MEDICAL_MANAGE]: 'Administrar historiales clinicos',
  [permissions.VACCINES_READ]: 'Ver vacunas',
  [permissions.VACCINES_MANAGE]: 'Administrar vacunas',
  [permissions.TREATMENTS_READ]: 'Ver tratamientos',
  [permissions.TREATMENTS_MANAGE]: 'Administrar tratamientos',
  [permissions.INVENTORY_READ]: 'Ver inventario',
  [permissions.INVENTORY_MANAGE]: 'Administrar inventario',
  [permissions.PAYMENTS_READ]: 'Ver pagos',
  [permissions.PAYMENTS_MANAGE]: 'Administrar pagos',
  [permissions.REPORTS_READ]: 'Ver reportes',
  [permissions.SETTINGS_MANAGE]: 'Administrar configuracion',
  [permissions.BACKUPS_MANAGE]: 'Administrar backups',
  [permissions.AUDIT_READ]: 'Ver auditoria',
};

const roleDefinitions = [
  {
    code: 'ADMIN',
    name: 'Administrador',
    description: 'Acceso completo al sistema',
    permissions: Object.values(permissions),
  },
  {
    code: 'VETERINARIAN',
    name: 'Veterinario',
    description: 'Atencion clinica y seguimiento de pacientes',
    permissions: [
      permissions.DASHBOARD_READ,
      permissions.OWNERS_READ,
      permissions.PETS_READ,
      permissions.PETS_MANAGE,
      permissions.APPOINTMENTS_READ,
      permissions.APPOINTMENTS_MANAGE,
      permissions.MEDICAL_READ,
      permissions.MEDICAL_MANAGE,
      permissions.VACCINES_READ,
      permissions.VACCINES_MANAGE,
      permissions.TREATMENTS_READ,
      permissions.TREATMENTS_MANAGE,
      permissions.INVENTORY_READ,
    ],
  },
  {
    code: 'RECEPTION',
    name: 'Recepcion',
    description: 'Registro de clientes, pacientes y agenda',
    permissions: [
      permissions.DASHBOARD_READ,
      permissions.OWNERS_READ,
      permissions.OWNERS_MANAGE,
      permissions.PETS_READ,
      permissions.PETS_MANAGE,
      permissions.APPOINTMENTS_READ,
      permissions.APPOINTMENTS_MANAGE,
      permissions.PAYMENTS_READ,
    ],
  },
  {
    code: 'CASHIER',
    name: 'Caja',
    description: 'Pagos, ventas e inventario',
    permissions: [
      permissions.DASHBOARD_READ,
      permissions.OWNERS_READ,
      permissions.PETS_READ,
      permissions.PAYMENTS_READ,
      permissions.PAYMENTS_MANAGE,
      permissions.INVENTORY_READ,
      permissions.INVENTORY_MANAGE,
      permissions.REPORTS_READ,
    ],
  },
];

type DemoUser = {
  firstName: string;
  lastName: string;
  email: string;
  roleCode: string;
};

type OwnerSeed = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
};

type PetSeed = {
  name: string;
  species: string;
  breed: string;
  sex: PetSex;
  ageMonths: number;
  weightKg: number;
  color: string;
};

type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  minimum: number;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  expirationOffsetDays?: number;
  supplier: string;
};

type PaymentLineSeed = {
  type: PaymentItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  productId?: string;
};

const demoUsers: DemoUser[] = [
  {
    firstName: 'Alejandro',
    lastName: 'Mantilla',
    email: `admin${demoEmailDomain}`,
    roleCode: 'ADMIN',
  },
  {
    firstName: 'Sofia',
    lastName: 'Ramirez',
    email: `sofia.ramirez${demoEmailDomain}`,
    roleCode: 'VETERINARIAN',
  },
  {
    firstName: 'Mateo',
    lastName: 'Cevallos',
    email: `mateo.cevallos${demoEmailDomain}`,
    roleCode: 'VETERINARIAN',
  },
  {
    firstName: 'Valentina',
    lastName: 'Paredes',
    email: `valentina.paredes${demoEmailDomain}`,
    roleCode: 'RECEPTION',
  },
  {
    firstName: 'Daniel',
    lastName: 'Mora',
    email: `daniel.mora${demoEmailDomain}`,
    roleCode: 'CASHIER',
  },
];

const ownerSeeds: OwnerSeed[] = [
  ['Carla', 'Suarez', '0994312001', 'carla.suarez@demo.local', 'Av. Amazonas N34-120'],
  ['Andres', 'Molina', '0987421033', 'andres.molina@demo.local', 'Kennedy Norte Mz. 12'],
  ['Sofia', 'Herrera', '0965512980', 'sofia.herrera@demo.local', 'La Carolina, Quito'],
  ['Gabriel', 'Torres', '0978123445', 'gabriel.torres@demo.local', 'Urdesa Central'],
  ['Natalia', 'Vera', '0992108831', 'natalia.vera@demo.local', 'Cumbaya, Quito'],
  ['Martin', 'Rivas', '0982217754', 'martin.rivas@demo.local', 'Samborondon Km 3'],
  ['Lucia', 'Castro', '0954412276', 'lucia.castro@demo.local', 'Centro Historico'],
  ['Diego', 'Almeida', '0967822110', 'diego.almeida@demo.local', 'Via a la Costa'],
  ['Paula', 'Benitez', '0998832415', 'paula.benitez@demo.local', 'Los Ceibos'],
  ['Ricardo', 'Naranjo', '0976651029', 'ricardo.naranjo@demo.local', 'El Condado'],
  ['Camila', 'Ortega', '0984567002', 'camila.ortega@demo.local', 'Tumbaco'],
  ['Javier', 'Salinas', '0997210450', 'javier.salinas@demo.local', 'Alborada 8va etapa'],
  ['Mariana', 'Crespo', '0963410098', 'mariana.crespo@demo.local', 'Miraflores'],
  ['Esteban', 'Ponce', '0957744103', 'esteban.ponce@demo.local', 'La Floresta'],
  ['Daniela', 'Munoz', '0986672101', 'daniela.munoz@demo.local', 'Bellavista'],
  ['Fernando', 'Cordero', '0975542811', 'fernando.cordero@demo.local', 'Garzota'],
  ['Isabella', 'Leon', '0991237644', 'isabella.leon@demo.local', 'Manta centro'],
  ['Sebastian', 'Arias', '0968712451', 'sebastian.arias@demo.local', 'Cuenca, El Vergel'],
  ['Renata', 'Villacis', '0989917204', 'renata.villacis@demo.local', 'Loja, San Sebastian'],
  ['Emilio', 'Zambrano', '0958821440', 'emilio.zambrano@demo.local', 'Machala norte'],
  ['Valeria', 'Mendoza', '0997731820', 'valeria.mendoza@demo.local', 'Daule, La Joya'],
  ['Hugo', 'Delgado', '0965538172', 'hugo.delgado@demo.local', 'Ambato, Ficoa'],
  ['Ana', 'Quintero', '0982211060', 'ana.quintero@demo.local', 'Riobamba centro'],
  ['Cristian', 'Bustos', '0974009812', 'cristian.bustos@demo.local', 'Portoviejo, Crucita'],
].map(([firstName, lastName, phone, email, address]) => ({
  firstName,
  lastName,
  phone,
  email,
  address,
}));

const extraOwnerFirstNames = [
  'Lorena',
  'Pablo',
  'Gabriela',
  'Ivan',
  'Marisol',
  'Kevin',
  'Patricia',
  'Alvaro',
  'Monica',
  'Rafael',
  'Viviana',
  'Oscar',
  'Elena',
  'Nicolas',
  'Teresa',
  'Julian',
  'Adriana',
  'Mauricio',
  'Silvia',
  'Felipe',
  'Romina',
  'Gustavo',
  'Cecilia',
  'Samuel',
];

const extraOwnerLastNames = [
  'Macias',
  'Espinoza',
  'Chavez',
  'Reyes',
  'Vargas',
  'Bravo',
  'Navarrete',
  'Coronel',
  'Aguirre',
  'Cisneros',
  'Palacios',
  'Lara',
  'Mera',
  'Villalba',
  'Proano',
  'Maldonado',
  'Carrion',
  'Barrera',
  'Vallejo',
  'Santos',
  'Arellano',
  'Cabrera',
  'Pazmino',
  'Jaramillo',
];

const expandedOwnerSeeds: OwnerSeed[] = [
  ...ownerSeeds,
  ...extraOwnerFirstNames.map((firstName, index) => {
    const lastName = extraOwnerLastNames[index];
    const slug = `${firstName}.${lastName}`.toLowerCase();
    return {
      firstName,
      lastName,
      phone: `09${String(42000000 + index * 731).padStart(8, '0')}`,
      email: `${slug}@demo.local`,
      address: [
        'Quito norte',
        'Guayaquil centro',
        'Cuenca historica',
        'Santo Domingo',
        'Ibarra residencial',
        'Latacunga centro',
      ][index % 6],
    };
  }),
];

const petSeeds: PetSeed[] = [
  { name: 'Max', species: 'Canino', breed: 'Golden Retriever', sex: PetSex.MALE, ageMonths: 62, weightKg: 29.4, color: 'Dorado' },
  { name: 'Luna', species: 'Felino', breed: 'Persa', sex: PetSex.FEMALE, ageMonths: 38, weightKg: 4.3, color: 'Gris' },
  { name: 'Rocky', species: 'Canino', breed: 'Pastor Aleman', sex: PetSex.MALE, ageMonths: 50, weightKg: 32.1, color: 'Negro y fuego' },
  { name: 'Milo', species: 'Canino', breed: 'French Bulldog', sex: PetSex.MALE, ageMonths: 26, weightKg: 11.2, color: 'Blanco con manchas' },
  { name: 'Nala', species: 'Felino', breed: 'Siames', sex: PetSex.FEMALE, ageMonths: 31, weightKg: 3.9, color: 'Crema' },
  { name: 'Simba', species: 'Felino', breed: 'Maine Coon', sex: PetSex.MALE, ageMonths: 44, weightKg: 7.1, color: 'Atigrado' },
  { name: 'Toby', species: 'Canino', breed: 'Beagle', sex: PetSex.MALE, ageMonths: 29, weightKg: 13.5, color: 'Tricolor' },
  { name: 'Kira', species: 'Canino', breed: 'Husky Siberiano', sex: PetSex.FEMALE, ageMonths: 54, weightKg: 21.9, color: 'Gris y blanco' },
  { name: 'Coco', species: 'Canino', breed: 'Poodle', sex: PetSex.MALE, ageMonths: 72, weightKg: 6.5, color: 'Blanco' },
  { name: 'Mia', species: 'Felino', breed: 'Criollo domestico', sex: PetSex.FEMALE, ageMonths: 18, weightKg: 3.4, color: 'Carey' },
  { name: 'Bruno', species: 'Canino', breed: 'Labrador Retriever', sex: PetSex.MALE, ageMonths: 84, weightKg: 34.6, color: 'Chocolate' },
  { name: 'Olivia', species: 'Felino', breed: 'Ragdoll', sex: PetSex.FEMALE, ageMonths: 21, weightKg: 4.8, color: 'Bicolor' },
  { name: 'Zeus', species: 'Canino', breed: 'Rottweiler', sex: PetSex.MALE, ageMonths: 46, weightKg: 41.2, color: 'Negro' },
  { name: 'Lola', species: 'Canino', breed: 'Schnauzer', sex: PetSex.FEMALE, ageMonths: 35, weightKg: 8.8, color: 'Sal y pimienta' },
  { name: 'Balu', species: 'Canino', breed: 'Mestizo', sex: PetSex.MALE, ageMonths: 19, weightKg: 18.2, color: 'Cafe' },
  { name: 'Kiara', species: 'Felino', breed: 'Bengali', sex: PetSex.FEMALE, ageMonths: 25, weightKg: 4.1, color: 'Moteado' },
  { name: 'Thor', species: 'Canino', breed: 'Boxer', sex: PetSex.MALE, ageMonths: 59, weightKg: 27.7, color: 'Atigrado' },
  { name: 'Canela', species: 'Canino', breed: 'Cocker Spaniel', sex: PetSex.FEMALE, ageMonths: 67, weightKg: 12.4, color: 'Canela' },
  { name: 'Copito', species: 'Conejo', breed: 'Mini Lop', sex: PetSex.MALE, ageMonths: 14, weightKg: 1.9, color: 'Blanco' },
  { name: 'Rex', species: 'Canino', breed: 'Doberman', sex: PetSex.MALE, ageMonths: 42, weightKg: 36.3, color: 'Negro y cafe' },
  { name: 'Pelusa', species: 'Felino', breed: 'Angora', sex: PetSex.FEMALE, ageMonths: 48, weightKg: 4.6, color: 'Blanco' },
  { name: 'Dante', species: 'Canino', breed: 'Border Collie', sex: PetSex.MALE, ageMonths: 33, weightKg: 19.5, color: 'Negro y blanco' },
  { name: 'Lia', species: 'Canino', breed: 'Shih Tzu', sex: PetSex.FEMALE, ageMonths: 27, weightKg: 5.9, color: 'Dorado y blanco' },
  { name: 'Tina', species: 'Felino', breed: 'Criollo domestico', sex: PetSex.FEMALE, ageMonths: 73, weightKg: 3.7, color: 'Negro' },
  { name: 'Chispa', species: 'Canino', breed: 'Jack Russell', sex: PetSex.FEMALE, ageMonths: 16, weightKg: 6.1, color: 'Blanco y cafe' },
  { name: 'Apolo', species: 'Canino', breed: 'Gran Danes', sex: PetSex.MALE, ageMonths: 40, weightKg: 56.4, color: 'Arlequin' },
  { name: 'Nina', species: 'Felino', breed: 'Sphynx', sex: PetSex.FEMALE, ageMonths: 22, weightKg: 3.2, color: 'Rosado' },
  { name: 'Pecas', species: 'Canino', breed: 'Dalmata', sex: PetSex.MALE, ageMonths: 58, weightKg: 24.8, color: 'Blanco con negro' },
  { name: 'Molly', species: 'Canino', breed: 'Yorkshire Terrier', sex: PetSex.FEMALE, ageMonths: 30, weightKg: 3.1, color: 'Gris y fuego' },
  { name: 'Bimba', species: 'Felino', breed: 'Azul Ruso', sex: PetSex.FEMALE, ageMonths: 36, weightKg: 4.0, color: 'Azul grisaceo' },
  { name: 'Odin', species: 'Canino', breed: 'Akita Inu', sex: PetSex.MALE, ageMonths: 52, weightKg: 38.6, color: 'Blanco y rojo' },
  { name: 'Loki', species: 'Canino', breed: 'Mestizo', sex: PetSex.MALE, ageMonths: 12, weightKg: 9.7, color: 'Negro' },
  { name: 'Princesa', species: 'Felino', breed: 'Exotico de pelo corto', sex: PetSex.FEMALE, ageMonths: 61, weightKg: 4.4, color: 'Crema' },
  { name: 'Lucky', species: 'Canino', breed: 'Mestizo', sex: PetSex.MALE, ageMonths: 77, weightKg: 17.8, color: 'Cafe claro' },
  { name: 'Maya', species: 'Canino', breed: 'Samoyedo', sex: PetSex.FEMALE, ageMonths: 24, weightKg: 18.6, color: 'Blanco' },
  { name: 'Tom', species: 'Felino', breed: 'Criollo domestico', sex: PetSex.MALE, ageMonths: 90, weightKg: 5.2, color: 'Atigrado naranja' },
];

const productSeeds: ProductSeed[] = [
  { sku: 'DEMO-VAC-RAB-01', name: 'Rabigen vacuna rabia', category: 'Vacunas', stock: 3, minimum: 5, unit: 'frasco', purchasePrice: 5.8, salePrice: 14.5, expirationOffsetDays: 140, supplier: 'VetLab Ecuador' },
  { sku: 'DEMO-VAC-DHPPI', name: 'Nobivac DHPPi', category: 'Vacunas', stock: 2, minimum: 10, unit: 'dosis', purchasePrice: 8.2, salePrice: 22, expirationOffsetDays: 90, supplier: 'Distribuidora AnimalCare' },
  { sku: 'DEMO-VAC-TRIPLE', name: 'Triple felina', category: 'Vacunas', stock: 12, minimum: 8, unit: 'dosis', purchasePrice: 7.4, salePrice: 21, expirationOffsetDays: 170, supplier: 'VetLab Ecuador' },
  { sku: 'DEMO-MED-MELOX2', name: 'Meloxicam 2 mg', category: 'Medicamentos', stock: 6, minimum: 20, unit: 'tableta', purchasePrice: 0.18, salePrice: 0.75, expirationOffsetDays: 260, supplier: 'Farmavet' },
  { sku: 'DEMO-MED-AMOX250', name: 'Amoxicilina 250 mg', category: 'Medicamentos', stock: 8, minimum: 30, unit: 'capsula', purchasePrice: 0.22, salePrice: 0.9, expirationOffsetDays: 320, supplier: 'Farmavet' },
  { sku: 'DEMO-MED-CEF500', name: 'Cefalexina 500 mg', category: 'Medicamentos', stock: 44, minimum: 25, unit: 'capsula', purchasePrice: 0.31, salePrice: 1.15, expirationOffsetDays: 420, supplier: 'Medipet' },
  { sku: 'DEMO-MED-DEXA', name: 'Dexametasona inyectable', category: 'Medicamentos', stock: 18, minimum: 8, unit: 'vial', purchasePrice: 1.8, salePrice: 5.5, expirationOffsetDays: 210, supplier: 'Medipet' },
  { sku: 'DEMO-DES-DRONTAL', name: 'Drontal Plus', category: 'Desparasitantes', stock: 25, minimum: 12, unit: 'tableta', purchasePrice: 1.6, salePrice: 4.8, expirationOffsetDays: 280, supplier: 'Animal Pharma' },
  { sku: 'DEMO-DES-PRAZI', name: 'Praziquantel suspension', category: 'Desparasitantes', stock: 9, minimum: 6, unit: 'frasco', purchasePrice: 4.1, salePrice: 11.5, expirationOffsetDays: 190, supplier: 'Animal Pharma' },
  { sku: 'DEMO-ANTI-FLEA', name: 'Antipulgas spot-on 10kg', category: 'Antipulgas', stock: 16, minimum: 10, unit: 'pipeta', purchasePrice: 3.2, salePrice: 9.9, expirationOffsetDays: 360, supplier: 'PetCare Supplies' },
  { sku: 'DEMO-INS-JER5', name: 'Jeringa esteril 5 ml', category: 'Insumos medicos', stock: 80, minimum: 50, unit: 'unidad', purchasePrice: 0.08, salePrice: 0.35, supplier: 'MediVet Insumos' },
  { sku: 'DEMO-INS-GUANTES', name: 'Guantes nitrilo caja', category: 'Insumos medicos', stock: 7, minimum: 5, unit: 'caja', purchasePrice: 5.6, salePrice: 9.5, supplier: 'MediVet Insumos' },
  { sku: 'DEMO-INS-GASA', name: 'Gasa esteril 10x10', category: 'Insumos medicos', stock: 120, minimum: 60, unit: 'paquete', purchasePrice: 0.35, salePrice: 1.1, supplier: 'MediVet Insumos' },
  { sku: 'DEMO-FOOD-PUPPY', name: 'Alimento cachorro premium 2kg', category: 'Alimentos', stock: 14, minimum: 6, unit: 'saco', purchasePrice: 9.8, salePrice: 18.5, supplier: 'NutriPet' },
  { sku: 'DEMO-FOOD-CAT', name: 'Alimento gato adulto 1.5kg', category: 'Alimentos', stock: 11, minimum: 8, unit: 'saco', purchasePrice: 8.4, salePrice: 16.2, supplier: 'NutriPet' },
  { sku: 'DEMO-ACC-COLLAR', name: 'Collar ajustable mediano', category: 'Accesorios', stock: 20, minimum: 8, unit: 'unidad', purchasePrice: 2.4, salePrice: 7.5, supplier: 'PetStore Mayorista' },
  { sku: 'DEMO-ACC-LEASH', name: 'Correa reforzada', category: 'Accesorios', stock: 13, minimum: 6, unit: 'unidad', purchasePrice: 3.6, salePrice: 10.5, supplier: 'PetStore Mayorista' },
  { sku: 'DEMO-HYG-SHAMPOO', name: 'Shampoo hipoalergenico', category: 'Higiene', stock: 10, minimum: 4, unit: 'frasco', purchasePrice: 3.9, salePrice: 9.8, supplier: 'GroomVet' },
  { sku: 'DEMO-HYG-EAR', name: 'Limpiador otico', category: 'Higiene', stock: 5, minimum: 4, unit: 'frasco', purchasePrice: 3.1, salePrice: 8.9, supplier: 'GroomVet' },
  { sku: 'DEMO-LAB-TEST', name: 'Test rapido parvovirus', category: 'Laboratorio', stock: 4, minimum: 5, unit: 'kit', purchasePrice: 6.8, salePrice: 18, expirationOffsetDays: 75, supplier: 'DiagnosVet' },
  { sku: 'DEMO-LAB-TUBE', name: 'Tubo EDTA', category: 'Laboratorio', stock: 70, minimum: 30, unit: 'unidad', purchasePrice: 0.12, salePrice: 0.55, supplier: 'DiagnosVet' },
  { sku: 'DEMO-SURG-SUTURE', name: 'Sutura nylon 3-0', category: 'Cirugia', stock: 22, minimum: 10, unit: 'unidad', purchasePrice: 1.3, salePrice: 4.2, supplier: 'SurgiVet' },
  { sku: 'DEMO-SURG-BLADE', name: 'Hoja bisturi #22', category: 'Cirugia', stock: 60, minimum: 30, unit: 'unidad', purchasePrice: 0.18, salePrice: 0.7, supplier: 'SurgiVet' },
  { sku: 'DEMO-MED-OMEP', name: 'Omeprazol 20 mg', category: 'Medicamentos', stock: 35, minimum: 20, unit: 'capsula', purchasePrice: 0.14, salePrice: 0.65, expirationOffsetDays: 340, supplier: 'Farmavet' },
  { sku: 'DEMO-MED-TRAM', name: 'Tramadol gotas', category: 'Medicamentos', stock: 6, minimum: 5, unit: 'frasco', purchasePrice: 5.3, salePrice: 13.9, expirationOffsetDays: 240, supplier: 'Medipet' },
  { sku: 'DEMO-CLEAN-DESINF', name: 'Desinfectante clinico', category: 'Limpieza', stock: 9, minimum: 4, unit: 'galon', purchasePrice: 6.5, salePrice: 12.5, supplier: 'BioClean' },
  { sku: 'DEMO-FOOD-RENAL', name: 'Dieta renal canina 2kg', category: 'Alimentos', stock: 4, minimum: 5, unit: 'saco', purchasePrice: 15.5, salePrice: 29.9, supplier: 'NutriPet' },
  { sku: 'DEMO-ACC-CARRIER', name: 'Transportador pequeno', category: 'Accesorios', stock: 3, minimum: 2, unit: 'unidad', purchasePrice: 12.5, salePrice: 28, supplier: 'PetStore Mayorista' },
];

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateOnly(value: Date): Date {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

function demoInvoice(index: number): string {
  return `DEMO-INV-${String(index).padStart(4, '0')}`;
}

async function clearDemoData(): Promise<void> {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: demoEmailDomain } },
    select: { id: true },
  });
  const userIds = demoUsers.map((user) => user.id);

  const demoOwners = await prisma.owner.findMany({
    where: { nationalId: { startsWith: demoOwnerPrefix } },
    select: { id: true },
  });
  const ownerIds = demoOwners.map((owner) => owner.id);

  const demoPets = await prisma.pet.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { id: true },
  });
  const petIds = demoPets.map((pet) => pet.id);

  const demoTreatments = await prisma.treatment.findMany({
    where: { petId: { in: petIds } },
    select: { id: true },
  });
  const treatmentIds = demoTreatments.map((treatment) => treatment.id);

  const demoPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { ownerId: { in: ownerIds } },
        { invoiceNumber: { startsWith: 'DEMO-INV-' } },
      ],
    },
    select: { id: true },
  });
  const paymentIds = demoPayments.map((payment) => payment.id);

  const demoPaymentItems = await prisma.paymentItem.findMany({
    where: { paymentId: { in: paymentIds } },
    select: { id: true },
  });
  const paymentItemIds = demoPaymentItems.map((item) => item.id);

  const demoProducts = await prisma.inventoryProduct.findMany({
    where: { sku: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const productIds = demoProducts.map((product) => product.id);

  const demoBatches = await prisma.inventoryBatch.findMany({
    where: { productId: { in: productIds } },
    select: { id: true },
  });
  const batchIds = demoBatches.map((batch) => batch.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { entityType: 'DemoSeed' },
        { entityId: { startsWith: 'DEMO-' } },
      ],
    },
  });
  await prisma.backupRecord.deleteMany({
    where: {
      OR: [
        { createdById: { in: userIds } },
        { databasePath: { contains: '\\demo\\' } },
        { filesPath: { contains: '\\demo\\' } },
      ],
    },
  });
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        { batchId: { in: batchIds } },
        { paymentItemId: { in: paymentItemIds } },
        { referenceId: { startsWith: 'DEMO-' } },
      ],
    },
  });
  await prisma.paymentTransaction.deleteMany({
    where: { paymentId: { in: paymentIds } },
  });
  await prisma.paymentItem.deleteMany({
    where: { paymentId: { in: paymentIds } },
  });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.mediaFile.deleteMany({
    where: {
      OR: [
        { petId: { in: petIds } },
        { treatmentId: { in: treatmentIds } },
        { uploadedById: { in: userIds } },
        { filePath: { contains: '\\demo\\' } },
      ],
    },
  });
  await prisma.treatmentEvolution.deleteMany({
    where: {
      OR: [
        { treatmentId: { in: treatmentIds } },
        { createdById: { in: userIds } },
      ],
    },
  });
  await prisma.treatment.deleteMany({ where: { id: { in: treatmentIds } } });
  await prisma.vaccine.deleteMany({ where: { petId: { in: petIds } } });
  await prisma.deworming.deleteMany({ where: { petId: { in: petIds } } });
  await prisma.medicalRecord.deleteMany({ where: { petId: { in: petIds } } });
  await prisma.appointment.deleteMany({ where: { petId: { in: petIds } } });
  await prisma.pet.deleteMany({ where: { id: { in: petIds } } });
  await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } });
  await prisma.inventoryBatch.deleteMany({
    where: { productId: { in: productIds } },
  });
  await prisma.inventoryProduct.deleteMany({
    where: { id: { in: productIds } },
  });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function seedAuthorization(): Promise<Record<string, string>> {
  for (const [code, description] of Object.entries(permissionDescriptions)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  const roleIds: Record<string, string> = {};
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        description: definition.description,
      },
      create: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
      },
    });
    roleIds[role.code] = role.id;

    const rolePermissions = await prisma.permission.findMany({
      where: { code: { in: definition.permissions } },
      select: { id: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: rolePermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  return roleIds;
}

async function seedUsers(
  roleIds: Record<string, string>,
): Promise<Record<string, string>> {
  const passwordHash = await bcrypt.hash('Demo2026!', 12);
  const userIds: Record<string, string> = {};

  for (const userSeed of demoUsers) {
    const user = await prisma.user.create({
      data: {
        firstName: userSeed.firstName,
        lastName: userSeed.lastName,
        email: userSeed.email,
        passwordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: daysFromNow(-1, 8, 10),
        roles: {
          create: { roleId: roleIds[userSeed.roleCode] },
        },
      },
    });
    userIds[userSeed.email] = user.id;
  }

  return userIds;
}

async function seedOwnersAndPets(): Promise<{
  owners: Array<{ id: string; firstName: string; lastName: string }>;
  pets: Array<{
    id: string;
    ownerId: string;
    name: string;
    species: string;
    breed: string | null;
  }>;
}> {
  const owners: Array<{ id: string; firstName: string; lastName: string }> = [];
  const pets: Array<{
    id: string;
    ownerId: string;
    name: string;
    species: string;
    breed: string | null;
  }> = [];

  for (const [index, ownerSeed] of expandedOwnerSeeds.entries()) {
    const owner = await prisma.owner.create({
      data: {
        firstName: ownerSeed.firstName,
        lastName: ownerSeed.lastName,
        nationalId: `${demoOwnerPrefix}${String(index + 1).padStart(4, '0')}`,
        phone: ownerSeed.phone,
        email: ownerSeed.email,
        address: ownerSeed.address,
        notes:
          index % 4 === 0
            ? 'Cliente demo con preferencia de recordatorio por WhatsApp.'
            : 'Registro ficticio para presentaciones comerciales.',
        registeredAt: daysFromNow(-90 + index, 9, 0),
        createdAt: daysFromNow(-90 + index, 9, 0),
      },
    });
    owners.push(owner);

    const petCount = index % 3 === 0 ? 2 : 1;
    for (let petOffset = 0; petOffset < petCount; petOffset += 1) {
      const petSeed = petSeeds[(index + petOffset * 7) % petSeeds.length];
      const pet = await prisma.pet.create({
        data: {
          ownerId: owner.id,
          name: petOffset === 0 ? petSeed.name : `${petSeed.name} Jr.`,
          species: petSeed.species,
          breed: petSeed.breed,
          sex: petSeed.sex,
          approximateAgeMonths: petSeed.ageMonths,
          weightKg: petSeed.weightKg,
          color: petSeed.color,
          status: PetStatus.ACTIVE,
          notes:
            petSeed.species === 'Felino'
              ? 'Paciente felino demo. Manejo suave durante consulta.'
              : 'Paciente demo activo para seguimiento clinico.',
          createdAt: daysFromNow(-80 + index + petOffset, 10, 0),
        },
      });
      pets.push(pet);
    }
  }

  return { owners, pets };
}

async function seedInventory(
  performedById: string,
): Promise<
  Array<{
    id: string;
    name: string;
    salePrice: number;
    currentStock: number;
  }>
> {
  const products: Array<{
    id: string;
    name: string;
    salePrice: number;
    currentStock: number;
  }> = [];

  for (const [index, productSeed] of productSeeds.entries()) {
    const product = await prisma.inventoryProduct.create({
      data: {
        sku: productSeed.sku,
        name: productSeed.name,
        category: productSeed.category,
        currentStock: productSeed.stock,
        minimumStock: productSeed.minimum,
        unit: productSeed.unit,
        purchasePrice: productSeed.purchasePrice,
        salePrice: productSeed.salePrice,
        expirationDate: productSeed.expirationOffsetDays
          ? dateOnly(daysFromNow(productSeed.expirationOffsetDays))
          : null,
        supplier: productSeed.supplier,
        isActive: true,
        createdAt: daysFromNow(-45 + index, 9, 0),
      },
    });

    const batch = await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNumber: `DEMO-L${String(index + 1).padStart(3, '0')}`,
        initialQuantity: productSeed.stock + 10,
        currentQuantity: productSeed.stock,
        unitCost: productSeed.purchasePrice,
        expirationDate: productSeed.expirationOffsetDays
          ? dateOnly(daysFromNow(productSeed.expirationOffsetDays))
          : null,
        receivedAt: daysFromNow(-30 + (index % 10), 11, 0),
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        batchId: batch.id,
        performedById,
        type: InventoryMovementType.PURCHASE,
        quantity: productSeed.stock + 10,
        unitCost: productSeed.purchasePrice,
        referenceType: 'DEMO_SEED',
        referenceId: `DEMO-PO-${String(index + 1).padStart(3, '0')}`,
        notes: 'Ingreso demo de inventario inicial.',
        createdAt: daysFromNow(-30 + (index % 10), 11, 10),
      },
    });

    products.push({
      id: product.id,
      name: product.name,
      salePrice: productSeed.salePrice,
      currentStock: productSeed.stock,
    });
  }

  return products;
}

async function seedAppointments(
  pets: Array<{ id: string; ownerId: string; name: string }>,
  veterinarianIds: string[],
): Promise<Array<{ id: string; petId: string; ownerId: string; startsAt: Date }>> {
  const appointments: Array<{
    id: string;
    petId: string;
    ownerId: string;
    startsAt: Date;
  }> = [];
  const types = [
    AppointmentType.GENERAL_CONSULTATION,
    AppointmentType.VACCINATION,
    AppointmentType.FOLLOW_UP,
    AppointmentType.GROOMING,
    AppointmentType.DEWORMING,
    AppointmentType.SURGERY,
  ];
  const statuses = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];

  let counter = 0;
  for (const pet of pets) {
    const baseDay = -18 + (counter % 36);
    for (let round = 0; round < (counter % 4 === 0 ? 2 : 1); round += 1) {
      const startsAt = daysFromNow(baseDay + round * 12, 8 + (counter % 9), counter % 2 === 0 ? 0 : 30);
      const status =
        startsAt < new Date()
          ? statuses[counter % statuses.length]
          : counter % 3 === 0
            ? AppointmentStatus.CONFIRMED
            : AppointmentStatus.PENDING;
      const appointment = await prisma.appointment.create({
        data: {
          petId: pet.id,
          ownerId: pet.ownerId,
          veterinarianId: veterinarianIds[counter % veterinarianIds.length],
          type: types[counter % types.length],
          status,
          startsAt,
          endsAt: addMinutes(startsAt, counter % 5 === 0 ? 60 : 35),
          reason: [
            'Consulta general y chequeo preventivo',
            'Vacunacion anual',
            'Control dermatologico',
            'Revision post tratamiento',
            'Limpieza dental',
            'Desparasitacion programada',
          ][counter % 6],
          notes:
            status === AppointmentStatus.CANCELLED
              ? 'Cita demo cancelada por solicitud del cliente.'
              : 'Cita demo creada para agenda comercial.',
          createdAt: daysFromNow(baseDay - 3, 9, 15),
        },
      });
      appointments.push(appointment);
      counter += 1;
    }
  }

  return appointments;
}

async function seedClinicalData(
  pets: Array<{ id: string; ownerId: string; name: string; species: string }>,
  appointments: Array<{ id: string; petId: string; startsAt: Date }>,
  veterinarianIds: string[],
  authorId: string,
): Promise<void> {
  const completedAppointments = appointments
    .filter((appointment) => appointment.startsAt < new Date())
    .slice(0, 60);

  for (const [index, appointment] of completedAppointments.entries()) {
    const pet = pets.find((item) => item.id === appointment.petId);
    if (!pet) continue;

    const record = await prisma.medicalRecord.create({
      data: {
        petId: pet.id,
        appointmentId: appointment.id,
        veterinarianId: veterinarianIds[index % veterinarianIds.length],
        type: [
          MedicalRecordType.CONSULTATION,
          MedicalRecordType.VACCINATION,
          MedicalRecordType.FOLLOW_UP,
          MedicalRecordType.TREATMENT,
          MedicalRecordType.LAB_RESULT,
        ][index % 5],
        occurredAt: appointment.startsAt,
        complaint: [
          'Decaimiento y bajo apetito desde hace 24 horas.',
          'Control preventivo sin signos de alarma.',
          'Prurito moderado en zona dorsal.',
          'Seguimiento de tratamiento antibiotico.',
          'Revision de carnet y esquema de vacunacion.',
        ][index % 5],
        symptoms: [
          'Temperatura normal, mucosas rosadas, hidratacion conservada.',
          'Ligera inflamacion cutanea, sin secrecion purulenta.',
          'Dolor leve a palpacion abdominal, apetito disminuido.',
          'Otitis externa leve con eritema.',
          'Paciente estable, buen estado general.',
        ][index % 5],
        diagnosis: [
          'Gastroenteritis leve.',
          'Dermatitis alergica estacional.',
          'Chequeo preventivo normal.',
          'Otitis externa inicial.',
          'Control clinico favorable.',
        ][index % 5],
        treatmentPlan: [
          'Dieta blanda, hidratacion oral y control en 48 horas.',
          'Antihistaminico, shampoo medicado y control dermatologico.',
          'Continuar plan preventivo y actualizar vacuna correspondiente.',
          'Limpieza otica diaria y gotas topicas por 7 dias.',
          'Mantener tratamiento actual y nueva revision programada.',
        ][index % 5],
        medications: [
          { name: 'Sucralfato', dose: '1 ml/kg', frequency: 'cada 12 horas' },
          { name: 'Meloxicam', dose: '0.1 mg/kg', frequency: 'cada 24 horas' },
        ],
        notes: 'Entrada clinica demo con informacion ficticia.',
        nextReviewAt: index % 3 === 0 ? daysFromNow(7 + index, 10, 0) : null,
        createdAt: appointment.startsAt,
      },
    });

    if (index < 24) {
      const treatment = await prisma.treatment.create({
        data: {
          petId: pet.id,
          medicalRecordId: record.id,
          veterinarianId: veterinarianIds[index % veterinarianIds.length],
          diagnosis: record.diagnosis ?? 'Tratamiento demo',
          instructions:
            'Administrar medicamentos segun indicacion, vigilar apetito y reportar signos de alarma.',
          medications: [
            { name: 'Amoxicilina', dose: '12.5 mg/kg', duration: '7 dias' },
            { name: 'ProbioVet', dose: '1 sobre', duration: '5 dias' },
          ],
          dosage: 'Segun peso actualizado del paciente',
          frequency: index % 2 === 0 ? 'Cada 12 horas' : 'Cada 24 horas',
          durationDays: index % 2 === 0 ? 7 : 10,
          startDate: dateOnly(daysFromNow(-12 + index)),
          endDate: index % 4 === 0 ? null : dateOnly(daysFromNow(-4 + index)),
          status: [
            TreatmentStatus.ACTIVE,
            TreatmentStatus.COMPLETED,
            TreatmentStatus.FOLLOW_UP,
            TreatmentStatus.SUSPENDED,
          ][index % 4],
          notes: 'Tratamiento demo para visualizar timeline y controles.',
          createdAt: daysFromNow(-12 + index, 9, 0),
        },
      });

      for (let evolutionIndex = 0; evolutionIndex < 3; evolutionIndex += 1) {
        await prisma.treatmentEvolution.create({
          data: {
            treatmentId: treatment.id,
            createdById: authorId,
            status: [
              TreatmentEvolutionStatus.STABLE,
              TreatmentEvolutionStatus.IMPROVING,
              TreatmentEvolutionStatus.RECOVERED,
            ][evolutionIndex],
            title: ['Control inicial', 'Mejora clinica', 'Recuperacion'][evolutionIndex],
            notes: [
              'Se inicia seguimiento. Paciente estable al examen fisico.',
              'Disminuye sintomatologia y mejora apetito.',
              'Evolucion favorable. Se indican cuidados preventivos.',
            ][evolutionIndex],
            weightKg: 4 + index + evolutionIndex * 0.2,
            occurredAt: daysFromNow(-10 + index + evolutionIndex * 3, 10, 0),
            nextReviewAt:
              evolutionIndex < 2
                ? daysFromNow(-7 + index + evolutionIndex * 3, 10, 0)
                : null,
          },
        });
      }
    }
  }

  for (const [index, pet] of pets.entries()) {
    const appliedAt = dateOnly(daysFromNow(-90 + (index % 40)));
    const nextDueDate = dateOnly(daysFromNow(-10 + (index % 35)));
    await prisma.vaccine.create({
      data: {
        petId: pet.id,
        veterinarianId: veterinarianIds[index % veterinarianIds.length],
        name: [
          'Rabia',
          'Parvovirus',
          'Triple felina',
          'Bordetella',
          'Leucemia felina',
        ][index % 5],
        manufacturer: ['Nobivac', 'Zoetis', 'Virbac', 'Boehringer'][index % 4],
        batchNumber: `DEMO-VAC-${String(index + 1).padStart(3, '0')}`,
        appliedAt,
        nextDueDate,
        status:
          nextDueDate < new Date()
            ? PreventiveCareStatus.OVERDUE
            : index % 4 === 0
              ? PreventiveCareStatus.UPCOMING
              : PreventiveCareStatus.APPLIED,
        notes: 'Registro demo de vacunacion.',
      },
    });

    if (index % 2 === 0) {
      const nextDeworming = dateOnly(daysFromNow(5 + (index % 45)));
      await prisma.deworming.create({
        data: {
          petId: pet.id,
          veterinarianId: veterinarianIds[index % veterinarianIds.length],
          medication: ['Drontal Plus', 'Praziquantel', 'Fenbendazol'][index % 3],
          appliedAt: dateOnly(daysFromNow(-60 + index)),
          nextDueDate: nextDeworming,
          weightKg: 4 + index * 0.8,
          dosage: index % 3 === 0 ? '1 tableta por 10 kg' : 'Segun peso',
          status:
            nextDeworming < new Date()
              ? PreventiveCareStatus.OVERDUE
              : PreventiveCareStatus.UPCOMING,
          notes: 'Desparasitacion demo.',
        },
      });
    }
  }
}

function paymentLine(input: PaymentLineSeed): {
  type: PaymentItemType;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
} {
  const subtotal = input.quantity * input.unitPrice;
  const discount = money((subtotal * input.discountPercent) / 100);
  return {
    type: input.type,
    productId: input.productId,
    description: input.description,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discount,
    total: money(subtotal - discount),
  };
}

function isCardPaymentMethod(method: PaymentMethod): boolean {
  return (
    method === PaymentMethod.CARD ||
    method === PaymentMethod.CARD_DEBIT ||
    method === PaymentMethod.CARD_CREDIT
  );
}

async function seedPayments(
  pets: Array<{ id: string; ownerId: string; name: string }>,
  products: Array<{ id: string; name: string; salePrice: number }>,
  cashierId: string,
): Promise<void> {
  const methods = [
    PaymentMethod.CASH,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CARD_DEBIT,
    PaymentMethod.CARD_CREDIT,
  ];

  for (let index = 0; index < 80; index += 1) {
    const pet = pets[index % pets.length];
    const product = products[index % products.length];
    const createdAt = daysFromNow(-35 + index, 10 + (index % 5), 0);
    const method = methods[index % methods.length];
    const lines = [
      paymentLine({
        type: PaymentItemType.SERVICE,
        description: [
          'Consulta general',
          'Control clinico',
          'Limpieza dental',
          'Vacunacion',
          'Consulta dermatologica',
        ][index % 5],
        quantity: 1,
        unitPrice: [25, 18, 35, 22, 28][index % 5],
        discountPercent: index % 6 === 0 ? 10 : 0,
      }),
      ...(index % 3 === 0
        ? [
            paymentLine({
              type: PaymentItemType.PRODUCT,
              productId: product.id,
              description: product.name,
              quantity: index % 2 === 0 ? 2 : 1,
              unitPrice: product.salePrice,
              discountPercent: index % 4 === 0 ? 5 : 0,
            }),
          ]
        : []),
    ];
    const subtotal = money(
      lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
    );
    const discount = money(lines.reduce((total, line) => total + line.discount, 0));
    const amount = money(lines.reduce((total, line) => total + line.total, 0));
    const status =
      index % 9 === 0
        ? PaymentStatus.PENDING
        : index % 7 === 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PAID;
    const paidAmount =
      status === PaymentStatus.PAID
        ? amount
        : status === PaymentStatus.PARTIAL
          ? money(amount * 0.45)
          : 0;

    await prisma.payment.create({
      data: {
        ownerId: pet.ownerId,
        petId: pet.id,
        createdById: cashierId,
        invoiceNumber: demoInvoice(index + 1),
        reference: `DEMO-PAY-${String(index + 1).padStart(4, '0')}`,
        description:
          lines.length === 1
            ? lines[0].description
            : `${lines[0].description} y ${lines.length - 1} concepto adicional`,
        subtotal,
        discount,
        amount,
        paidAmount,
        method,
        status,
        paidAt: paidAmount > 0 ? createdAt : null,
        dueAt: status === PaymentStatus.PAID ? null : daysFromNow(8 + index, 12, 0),
        notes: 'Documento de cobro demo.',
        createdAt,
        items: {
          create: lines.map((line) => ({
            type: line.type,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            total: line.total,
          })),
        },
        ...(paidAmount > 0
          ? {
              transactions: {
                create: {
                  createdById: cashierId,
                  amount: paidAmount,
                  method,
                  reference:
                    isCardPaymentMethod(method)
                      ? `VOUCHER-DEMO-${String(index + 1).padStart(4, '0')}`
                      : `REF-DEMO-${String(index + 1).padStart(4, '0')}`,
                  notes: 'Movimiento de caja demo.',
                  receivedAt: createdAt,
                  createdAt,
                },
              },
            }
          : {}),
      },
    });
  }
}

async function writeDemoFile(path: string, content: string): Promise<number> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

async function seedMediaAndBackups(
  pets: Array<{ id: string; name: string }>,
  uploadedById: string,
): Promise<void> {
  await mkdir(demoUploadsPath, { recursive: true });
  await mkdir(demoBackupsPath, { recursive: true });

  const mediaPets = pets.slice(0, 30);

  for (const [index, pet] of mediaPets.entries()) {
    const fileName = `demo_${String(index + 1).padStart(2, '0')}_${pet.name.toLowerCase()}.svg`;
    const filePath = join(demoUploadsPath, fileName);
    const color = ['#0f766e', '#2563eb', '#ea580c', '#7c3aed'][index % 4];
    const size = await writeDemoFile(
      filePath,
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" rx="32" fill="${color}"/><text x="50%" y="48%" text-anchor="middle" fill="white" font-size="42" font-family="Arial">${pet.name}</text><text x="50%" y="60%" text-anchor="middle" fill="white" font-size="22" font-family="Arial">Archivo clinico demo</text></svg>`,
    );

    const media = await prisma.mediaFile.create({
      data: {
        petId: pet.id,
        uploadedById,
        filePath,
        originalName: fileName,
        storedName: fileName,
        mimeType: 'image/svg+xml',
        sizeBytes: BigInt(size),
        category:
          index % 3 === 0
            ? MediaCategory.PET_PROFILE
            : index % 3 === 1
              ? MediaCategory.EVOLUTION
              : MediaCategory.DOCUMENT,
        tags: ['demo', 'presentacion', pet.name.toLowerCase()],
        createdAt: daysFromNow(-20 + index, 14, 0),
      },
    });

    if (index < 8) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: { photoPath: media.filePath },
      });
    }
  }

  const sqlPath = join(demoBackupsPath, 'demo_backup_2026_06_19.sql');
  const zipPath = join(demoBackupsPath, 'demo_files_2026_06_19.zip');
  const sqlSize = await writeDemoFile(
    sqlPath,
    '-- Backup demo ficticio de VetCare Pro\nselect 1;\n',
  );
  const zipSize = await writeDemoFile(
    zipPath,
    'Archivo demo para representar respaldo ZIP de documentos clinicos.\n',
  );

  await prisma.backupRecord.create({
    data: {
      status: BackupStatus.COMPLETED,
      databasePath: sqlPath,
      filesPath: zipPath,
      sizeBytes: BigInt(sqlSize + zipSize),
      createdById: uploadedById,
      createdAt: daysFromNow(-1, 18, 0),
      completedAt: daysFromNow(-1, 18, 2),
    },
  });
}

async function seedSettingsAndAudit(actorId: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: 'clinic.profile' },
    update: {
      value: {
        name: 'Clinica VetCare Demo',
        phone: '02-600-2026',
        email: 'contacto@vetcare.demo',
        address: 'Av. Principal 123 y Los Pinos',
        city: 'Quito',
        mode: 'DEMO',
      },
      updatedById: actorId,
    },
    create: {
      key: 'clinic.profile',
      value: {
        name: 'Clinica VetCare Demo',
        phone: '02-600-2026',
        email: 'contacto@vetcare.demo',
        address: 'Av. Principal 123 y Los Pinos',
        city: 'Quito',
        mode: 'DEMO',
      },
      description: 'Perfil demo de la veterinaria',
      updatedById: actorId,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'demo.seed' },
    update: {
      value: {
        enabled: true,
        generatedAt: new Date().toISOString(),
        note: 'Datos ficticios para demostraciones comerciales.',
      },
      updatedById: actorId,
    },
    create: {
      key: 'demo.seed',
      value: {
        enabled: true,
        generatedAt: new Date().toISOString(),
        note: 'Datos ficticios para demostraciones comerciales.',
      },
      description: 'Marca de datos demo',
      updatedById: actorId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: AuditAction.CREATE,
      entityType: 'DemoSeed',
      entityId: 'DEMO-SEED-1.0.0',
      changes: {
        message: 'Datos demo ficticios cargados para desarrollo.',
      },
      createdAt: new Date(),
    },
  });
}

async function main(): Promise<void> {
  console.log('VetCare Pro demo seed');
  console.log(`Database: ${connectionString.replace(/:[^:@/]+@/, ':***@')}`);

  await clearDemoData();
  const roleIds = await seedAuthorization();
  const userIds = await seedUsers(roleIds);
  const adminId = userIds[`admin${demoEmailDomain}`];
  const veterinarianIds = [
    userIds[`sofia.ramirez${demoEmailDomain}`],
    userIds[`mateo.cevallos${demoEmailDomain}`],
  ];
  const cashierId = userIds[`daniel.mora${demoEmailDomain}`];

  const { owners, pets } = await seedOwnersAndPets();
  const products = await seedInventory(cashierId);
  const appointments = await seedAppointments(pets, veterinarianIds);
  await seedClinicalData(pets, appointments, veterinarianIds, adminId);
  await seedPayments(pets, products, cashierId);
  await seedMediaAndBackups(pets, adminId);
  await seedSettingsAndAudit(adminId);

  console.log('');
  console.log('Datos demo cargados correctamente.');
  console.table({
    usuarios: demoUsers.length,
    duenos: owners.length,
    mascotas: pets.length,
    productos: products.length,
    citas: appointments.length,
    pagos: 80,
    archivos: Math.min(pets.length, 30),
  });
  console.log('');
  console.log('Accesos demo:');
  console.log(`  admin${demoEmailDomain} / Demo2026!`);
  console.log(`  sofia.ramirez${demoEmailDomain} / Demo2026!`);
  console.log(`  valentina.paredes${demoEmailDomain} / Demo2026!`);
  console.log(`  daniel.mora${demoEmailDomain} / Demo2026!`);
}

main()
  .catch((error: unknown) => {
    console.error('No fue posible cargar datos demo.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
