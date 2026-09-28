import type { UsersResponse, ChatMessage } from './types';

export const dummyUsersResponse: UsersResponse = {
  data: [
    {
      id: "7a3cca55-6eeb-437c-b36b-ccb9cb86fc52",
      email: "admin@example.com",
      username: "superadmin",
      name: "Platform Admin",
      role: "ADMIN",
      avatarUrl: null,
      bio: null,
      isActive: true,
      createdAt: "2026-09-28T20:08:50.993Z",
      updatedAt: "2026-09-28T20:08:50.993Z"
    },
    {
      id: "800cb6b5-21ea-4b86-896e-70b9951c07e5",
      email: "mentee.bob@example.com",
      username: "bob_mentee",
      name: "Bob Mentee",
      role: "MENTEE",
      avatarUrl: null,
      bio: "Aspiring Frontend Developer",
      isActive: true,
      createdAt: "2026-09-28T20:08:27.666Z",
      updatedAt: "2026-09-28T20:08:27.666Z"
    },
    {
      id: "a19c11a5-aa20-4908-957c-51afa9580eeb",
      email: "mentor.alice@example.com",
      username: "alice_mentor",
      name: "Alice Mentor",
      role: "MENTOR",
      avatarUrl: null,
      bio: "Expert Software Engineer",
      isActive: true,
      createdAt: "2026-09-28T20:07:35.561Z",
      updatedAt: "2026-09-28T20:07:35.561Z"
    }
  ],
  meta: {
    total: 3,
    page: 1,
    limit: 20,
    totalPages: 1
  }
};

export const initialMessages: Record<string, ChatMessage[]> = {
  "7a3cca55-6eeb-437c-b36b-ccb9cb86fc52": [
    {
      id: "msg-admin-1",
      senderId: "7a3cca55-6eeb-437c-b36b-ccb9cb86fc52",
      receiverId: "current-user",
      text: "Welcome to the Chat Portal! Let us know if you need any assistance.",
      timestamp: "10:30 AM"
    },
    {
      id: "msg-admin-2",
      senderId: "current-user",
      receiverId: "7a3cca55-6eeb-437c-b36b-ccb9cb86fc52",
      text: "Thanks! Everything looks great so far.",
      timestamp: "10:32 AM"
    }
  ],
  "800cb6b5-21ea-4b86-896e-70b9951c07e5": [
    {
      id: "msg-bob-1",
      senderId: "800cb6b5-21ea-4b86-896e-70b9951c07e5",
      receiverId: "current-user",
      text: "Hi! I am working on CSS layouts and flexbox today.",
      timestamp: "11:15 AM"
    },
    {
      id: "msg-bob-2",
      senderId: "current-user",
      receiverId: "800cb6b5-21ea-4b86-896e-70b9951c07e5",
      text: "Awesome! Flexbox is super useful for building chat applications.",
      timestamp: "11:18 AM"
    },
    {
      id: "msg-bob-3",
      senderId: "800cb6b5-21ea-4b86-896e-70b9951c07e5",
      receiverId: "current-user",
      text: "Yes, I am practicing building a sidebar and chat feed right now!",
      timestamp: "11:20 AM"
    }
  ],
  "a19c11a5-aa20-4908-957c-51afa9580eeb": [
    {
      id: "msg-alice-1",
      senderId: "a19c11a5-aa20-4908-957c-51afa9580eeb",
      receiverId: "current-user",
      text: "Hello! Don't forget to review our architecture notes when you have time.",
      timestamp: "09:00 AM"
    },
    {
      id: "msg-alice-2",
      senderId: "current-user",
      receiverId: "a19c11a5-aa20-4908-957c-51afa9580eeb",
      text: "Will do, Alice. Thanks for sharing them!",
      timestamp: "09:12 AM"
    }
  ]
};
