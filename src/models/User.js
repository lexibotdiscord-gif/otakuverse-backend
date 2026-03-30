import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: true,
    select: false,
    minlength: 6
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  donorLevel: {
    type: String,
    enum: ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'LEGEND'],
    default: 'NONE'
  },
  isPublicProfile: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    enum: ['LIGHT', 'DARK', 'CYBERPUNK', 'NEON_PURPLE', 'NEON_CYAN', 'NARUTO_THEME', 'DEMON_SLAYER_THEME', 'AUTO'],
    default: 'DARK'
  },
  favoriteAnimeIds: [Number],
  favoriteMangaIds: [Number],
  watchlist: [{
    animeId: Number,
    status: String,
    episodesWatched: Number,
    score: Number,
    addedAt: Date
  }],
  readlist: [{
    mangaId: Number,
    status: String,
    chaptersRead: Number,
    score: Number,
    addedAt: Date
  }],
  statistics: {
    totalHoursWatched: {
      type: Number,
      default: 0
    },
    totalChaptersRead: {
      type: Number,
      default: 0
    },
    animeCompleted: {
      type: Number,
      default: 0
    },
    mangaCompleted: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    }
  },
  badges: [{
    id: String,
    name: String,
    description: String,
    icon: String,
    earnedAt: Date,
    rarityLevel: String
  }],
  followers: [mongoose.Schema.Types.ObjectId],
  following: [mongoose.Schema.Types.ObjectId],
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    spoilerAlertEnabled: {
      type: Boolean,
      default: true
    },
    adultContentAllowed: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: false
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    favoriteGenres: [String],
    favoriteStudios: [String]
  }
});

UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('User', UserSchema);