import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const auth = getAuth();

// Register the company
const registerCompany = async (email, password, companyName) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send verification email
        await sendEmailVerification(user);

        // You can optionally create the company document in Firestore here (with the company name, email, etc.)
        const companyDocRef = doc(db, "companies", user.uid);
        await setDoc(companyDocRef, {
            companyName,
            email: user.email,
            createdAt: new Date()
        });

        console.log("Verification email sent. Please check your inbox.");
    } catch (error) {
        console.error("Error registering company:", error.message);
    }
};
