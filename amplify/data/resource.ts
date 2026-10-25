import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

// Visitors use guest (identity pool) access: they can read the gallery and send
// estimate requests and reviews, but never read submissions back.
// Signed-in admins can do everything.
const schema = a.schema({
  GalleryPhoto: a
    .model({
      // storage path for an uploaded photo, e.g. gallery/1234-kitchen.jpg
      path: a.string(),
      // a photo bundled with the site, e.g. photos/k-1.jpg
      src: a.string(),
      caption: a.string().required(),
      category: a.enum(['kitchen', 'bath', 'outdoor', 'addition']),
      sortOrder: a.integer().required(),
    })
    .authorization((allow) => [allow.guest().to(['read']), allow.authenticated()]),

  // Sent from the Contact page
  EstimateRequest: a
    .model({
      projectType: a.string().required(),
      timing: a.string().required(),
      details: a.string(),
      name: a.string().required(),
      phone: a.string(),
      email: a.string(),
      village: a.string(),
    })
    .authorization((allow) => [allow.guest().to(['create']), allow.authenticated().to(['read', 'delete'])]),

  // Sent from the Reviews page
  ReviewSubmission: a
    .model({
      rating: a.integer().required(),
      name: a.string().required(),
      location: a.string(),
      project: a.string().required(),
      highlights: a.string().array(),
      review: a.string().required(),
      email: a.string(),
      allowPublish: a.boolean(),
      // set while the review is on the site
      publishedReviewId: a.id(),
    })
    .authorization((allow) => [allow.guest().to(['create']), allow.authenticated().to(['read', 'update', 'delete'])]),

  // What the Reviews page shows. Created from a ReviewSubmission with the admin
  // page's Publish button; only the parts the reviewer agreed to share, never their email.
  PublishedReview: a
    .model({
      name: a.string().required(),
      location: a.string(),
      project: a.string(),
      rating: a.integer().required(),
      highlights: a.string().array(),
      review: a.string().required(),
    })
    .authorization((allow) => [allow.guest().to(['read']), allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
