db = db.getSiblingDB('pitch')

db.createUser({
  user: 'root',
  pwd: 'password',
  roles: [{ role: 'readWrite', db: 'pitch' }],
})
