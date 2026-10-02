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
    { days: "Monday - Friday", time: "9:00 AM - 6:00 PM" },
    { days: "Saturday", time: "9:00 AM - 4:00 PM" },
    { days: "Sunday", time: "Closed" },
  ], // PLACEHOLDER
  copyrightHolder: "VetCare Veterinary Clinic", // PLACEHOLDER
} as const;

export type ServiceItem = {
  name: string;
  description: string;
  details: string;
  featured: boolean;
};

// PLACEHOLDER services. In a later phase services become configurable by the Senior Vet.
export const services: ServiceItem[] = [
  {
    name: "Veterinary Consultation",
    description: "Thorough check-ups and expert advice for your pet's health concerns.",
    details:
      "A one-on-one consultation with our veterinarian to assess your pet, answer your questions, and recommend the right care plan.",
    featured: true,
  },
  {
    name: "Vaccination",
    description: "Core and optional vaccines to protect your pet from preventable disease.",
    details:
      "Age-appropriate vaccination schedules, with reminders so your pet stays protected year-round.",
    featured: true,
  },
  {
    name: "Grooming",
    description: "Bathing, trimming and coat care in a calm, pet-friendly space.",
    details:
      "Gentle grooming services that keep your pet clean, comfortable and healthy, from baths to haircuts.",
    featured: true,
  },
  {
    name: "Deworming",
    description: "Safe, effective parasite control for puppies, kittens and adults.",
    details:
      "Regular deworming to protect your pet and your household from intestinal parasites.",
    featured: true,
  },
  {
    name: "Wellness Check",
    description: "Routine examinations that catch small issues before they grow.",
    details:
      "A complete preventive health review, including weight monitoring and personalized care recommendations.",
    featured: true,
  },
];

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
  bio: string;
};

// PLACEHOLDER team members (no real people or photos yet).
export const team: TeamMember[] = [
  {
    name: "Dr. Alex Sample",
    title: "Senior Veterinarian",
    bio: "Leads the clinic's medical team with a focus on preventive care and client education.",
  },
  {
    name: "Dr. Jamie Placeholder",
    title: "Veterinarian",
    bio: "Passionate about small-animal medicine, vaccinations and wellness care.",
  },
  {
    name: "Taylor Example",
    title: "Veterinary Technician",
    bio: "Assists with examinations and helps every pet feel calm and comfortable.",
  },
  {
    name: "Morgan Demo",
    title: "Clinic Receptionist",
    bio: "Your friendly first point of contact for appointments and questions.",
  },
];

export const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About Us" },
  { href: "/veterinary-team", label: "Meet Our Veterinary Team" },
  { href: "/book-appointment", label: "Book an Appointment" },
] as const;
