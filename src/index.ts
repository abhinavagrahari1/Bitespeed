// @ts-nocheck
import { Hono } from 'hono'
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
  };
}>


// DELETE ALL RECORDS

app.get('/delete', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const deleteUsers = await prisma.user.deleteMany({})

  return c.json({ deleteUsers });
})

//GET ALL RECORDS

app.get('/', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const users = await prisma.user.findMany()

  return c.json({ users });
})


//Identify API

app.post('/identify', async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    let res;
    let matchingPhoneUsers = [];
    let matchingEmailUsers = [];
    let matchingAllUsers = [];

    //fetch existing data
    matchingAllUsers = await prisma.user.findMany({
      where: {
        OR: [
          { phoneNumber: body.phoneNumber },
          { email: body.email },
        ],
      },
    });


    if (!body.phoneNumber) {
      const userPhoneNumbers = matchingAllUsers.map(entry => entry.phoneNumber).filter(phoneNumber => phoneNumber !== null).map(phoneNumber => phoneNumber as string);

      // Query the database to find users with matching phone numbers
      matchingPhoneUsers = await prisma.user.findMany({
        where: {
          phoneNumber: {
            in: userPhoneNumbers,
          },
        },
      });
    }

    if (!body.email) {
      const userEmails = matchingAllUsers.map(entry => entry.email).filter(email => email !== null).map(email => email as string);

      // Query the database to find users with matching phone numbers
      matchingEmailUsers = await prisma.user.findMany({
        where: {
          phoneNumber: {
            in: userEmails,
          },
        },
      });
    }

    let existingUserEntries = [...matchingAllUsers, ...matchingEmailUsers, ...matchingPhoneUsers].reduce((acc, obj) => {
      const existingObj = acc.find(item => item.id === obj.id);
      if (!existingObj) {
        acc.push(obj);
      }
      return acc;
    }, []);

    console.log("Exisitng Entries:", existingUserEntries);

    //============================* If there are entries with either email or phone number *===============================// 

    if (existingUserEntries.length > 0) {
      // =============================* Find Primary Entries *===================================================//
      const primaryEntries = existingUserEntries.filter(entry => entry.linkPrecedence === "Primary");

      console.log("Primary Entries:", primaryEntries);



      if (primaryEntries.length === 2) {

        // ====================* If there are 2 Primary Entries, assign the matching email as secondary link precedence *================//

        const matchingEmailEntry = primaryEntries.find(entry => entry.email === body.email);
        const matchingPhoneEntry = primaryEntries.find(entry => entry.phoneNumber === body.phoneNumber);

        if (matchingEmailEntry && matchingPhoneEntry) {
          await prisma.user.update({
            where: { id: matchingEmailEntry.id },
            data: { linkPrecedence: "Secondary", linkedId: matchingPhoneEntry.id },
          });
        }

        res = {
          contact: {
            primaryContactId: matchingPhoneEntry.id,
            emails: [...new Set(existingUserEntries.map(entry => entry.email).filter(Boolean))],
            phoneNumbers: [...new Set(existingUserEntries.map(entry => entry.phoneNumber).filter(Boolean))],
            secondaryContactIds: [...new Set(existingUserEntries.map(entry => entry.id).filter(id => id !== matchingPhoneEntry.id))],
          }
        }

        return c.body(JSON.stringify(res));

      } else {

        // =====================* If there is only 1 Primary entry *=============================================//

        // ===========* If User is already present in the database with same email and phonenumber, then we won't need to create new entry *=========//

        const matchingEntry = existingUserEntries.find(entry =>
          entry.email === body.email &&
          (entry.phoneNumber === body.phoneNumber)
        );

        console.log("Matching Entries:", matchingEntry);

        if (matchingEntry) {
          res = {
            contact: {
              primaryContactId: primaryEntries[0].id,
              emails: [...new Set(existingUserEntries.map(entry => entry.email).filter(Boolean))],
              phoneNumbers: [...new Set(existingUserEntries.map(entry => entry.phoneNumber).filter(Boolean))],
              secondaryContactIds: [...new Set(existingUserEntries.map(entry => entry.id).filter(id => id !== primaryEntries[0].id))],
            },
          }

          return c.body(JSON.stringify(res));
        } else if (body.email == null || body.phoneNumber == null) {
          console.log("Inside:", primaryEntries[0].id);
          res = {
            contact: {
              primaryContactId: primaryEntries[0].id,
              emails: [...new Set(existingUserEntries.map(entry => entry.email).filter(Boolean))],
              phoneNumbers: [...new Set(existingUserEntries.map(entry => entry.phoneNumber).filter(Boolean))],
              secondaryContactIds: [...new Set(existingUserEntries.map(entry => entry.id).filter(id => id !== primaryEntries[0].id))],
            },
          }

          return c.body(JSON.stringify(res));
        } else if (!matchingEntry && body.email && body.phoneNumber) {
          // ===========* If User is not already present in the database with exact same email and phonenumber, and none of the provided value is null, then we would create new entry *=========//
          const newEntry = await prisma.user.create({
            data: {
              phoneNumber: body.phoneNumber,
              email: body.email,
              linkedId: primaryEntries[0].id,
              linkPrecedence: "Secondary"
            },
          });

          res = {
            contact: {
              primaryContactId: primaryEntries[0].id,
              emails: [...new Set(existingUserEntries.map(entry => entry.email).filter(Boolean).concat(newEntry.email))],
              phoneNumbers: [...new Set(existingUserEntries.map(entry => entry.phoneNumber).filter(Boolean).concat(newEntry.phoneNumber))],
              secondaryContactIds: [...new Set(existingUserEntries.map(entry => entry.id).filter(id => id !== primaryEntries[0].id).concat(newEntry.id))],
            },
          };
        };
      }

      return c.body(JSON.stringify(res));
    } else if (existingUserEntries.length == 0 && body.phoneNumber && body.email) {
      //============================* If there are no entries with either email or phone number *===============================// 
      const newEntry = await prisma.user.create({
        data: {
          phoneNumber: body.phoneNumber,
          email: body.email,
          linkPrecedence: "Primary"
        },
      });

      res = {
        contact: {
          primaryContactId: newEntry.id,
          emails: [newEntry.email],
          phoneNumbers: [newEntry.phoneNumber],
          secondaryContactIds: []
        }
      }

      return c.body(JSON.stringify(res));
    } else {
      return c.body("Input data incomplete, Provide Email and Phone Number")
    }
  } catch (error) {
    console.log(error);
    c.status(400);
    return c.body(JSON.stringify(error));
  }

})


export default app

