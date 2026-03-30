import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  source: String,
  category: {
    type: String,
    enum: [
      'ANIME',
      'MANGA',
      'LIGHT_NOVEL',
      'INDUSTRY',
      'STUDIOS',
      'VOICE_ACTORS',
      'EVENTS',
      'ANNOUNCEMENTS',
      'TRENDS',
      'RUMOR',
      'LEAK',
      'OFFICIAL'
    ],
    default: 'ANIME'
  },
  badge: {
    type: String,
    enum: ['OFFICIAL', 'RUMOR', 'CONFIRMED', 'BREAKING', 'TRENDING', 'VERIFIED'],
    default: 'RUMOR'
  },
  imageUrl: String,
  videoUrl: String,
  relatedAnimeIds: [Number],
  relatedMangaIds: [Number],
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  viewCount: {
    type: Number,
    default: 0,
    index: true
  },
  likeCount: {
    type: Number,
    default: 0
  },
  likedBy: [mongoose.Schema.Types.ObjectId],
  commentCount: {
    type: Number,
    default: 0
  },
  isBreakingNews: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  url: String,
  credibilityScore: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  verificationStatus: {
    type: String,
    enum: ['UNVERIFIED', 'PENDING', 'CONFIRMED', 'DEBUNKED', 'PARTIALLY_CONFIRMED'],
    default: 'UNVERIFIED'
  },
  communityVotes: {
    type: Number,
    default: 0
  },
  communityDownvotes: {
    type: Number,
    default: 0
  }
});

// Index for better query performance
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ category: 1, publishedAt: -1 });
NewsSchema.index({ viewCount: -1 });
NewsSchema.index({ title: 'text', description: 'text', content: 'text' });

NewsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('News', NewsSchema);