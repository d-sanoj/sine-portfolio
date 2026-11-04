// Which photos are traced. They live in data/source/photos/ and are served at /photos/.
export const COUNT = 1;
export const photoUrl = (i) => '/photos/portrait-' + String(i + 1).padStart(2, '0') + '.jpg';
