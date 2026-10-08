/**
 * ALL PLACEHOLDER CONTENT LIVES HERE.
 * Replace these values with the real clinic details; every public page reads from this file.
 */

export const clinic = {
  name: "VetCare Veterinary Clinic", // PLACEHOLDER clinic name
  shortName: "VetCare",
  tagline: "Gentle, trusted care for every member of your family.", // PLACEHOLDER
  intro:
    "We are a friendly neighborhood clinic dedicated to keeping your pets healthy and happy. Book your visit online, from home, in just a few steps.", // PLACEHOLDER
  about: {
    summary:
      "Our clinic has served pet owners in the community with compassionate, modern veterinary care. We believe every pet deserves attentive treatment and every owner deserves clear, honest communication.", // PLACEHOLDER
    story:
      "Founded by a small team of passionate veterinarians and animal lovers, we combine modern medicine with a warm, personal approach. From routine wellness checks to vaccinations and grooming, we make every visit calm and stress-free for pets and their people.", // PLACEHOLDER
    mission:
      "To provide accessible, compassionate veterinary care that keeps pets healthy and families connected to the clinic through convenient, reliable service.", // PLACEHOLDER
  },
  contact: {
    address: "123 Sample Street, Barangay Placeholder, Sample City, Philippines", // PLACEHOLDER
    phone: "(000) 123-4567", // PLACEHOLDER
    mobile: "0900 000 0000", // PLACEHOLDER
    email: "hello@vetcare-clinic.example", // PLACEHOLDER
  },
  hours: [
    { days: "Monday - Saturday", time: "9:00 AM - 6:00 PM" },
    { days: "Sunday", time: "9:00 AM - 4:00 PM" },
  ], // PLACEHOLDER
  copyrightHolder: "VetCare Veterinary Clinic", // PLACEHOLDER
} as const;

export const whyChooseUs = [
  {
    title: "Compassionate Care",
    description: "We treat every pet with patience, gentleness and respect.",
  },
  {
    title: "Experienced Veterinary Team",
    description: "Skilled professionals who keep learning and keep caring.",
  },
  {
    title: "Convenient Appointments",
    description: "Book your visit online, from home, whenever it suits you.",
  },
  {
    title: "Complete Pet Records",
    description: "Your pet's history is organized and easy to access in one place.",
  },
] as const;

export type TeamMember = {
  name: string;
  title: string;
};

export const team: TeamMember[] = [
  { name: "Dr. Carmela Dawn R. De Guzman, DVM", title: "Veterinarian" },
  { name: "Dr. Merlyn P. Castelo, DVM", title: "Veterinarian" },
  { name: "Dr. John Kenneth P. Adan, DVM", title: "Veterinarian" },
  { name: "Fyona Mari Basco", title: "Veterinary Intern" },
  { name: "Katrina V. Barra", title: "Veterinary Intern" },
  { name: "Renz Mark", title: "Veterinary Assistant" },
  { name: "RK Marie Amor", title: "Clinic Receptionist" },
  { name: "Steve-O Bradley", title: "Employee Cat of the Month" },
];

export const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About Us" },
  { href: "/veterinary-team", label: "Meet Our Veterinary Team" },
  { href: "/book-appointment", label: "Book an Appointment" },
] as const;
