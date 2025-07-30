
import OpenAI from "openai";
import sql from "../configs/db.js"
import { clerkClient } from "@clerk/express";
import axios from "axios";
import {v2 as cloudinary} from "cloudinary";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import  {upload}  from '../configs/multer.js';


const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});


export const generateArticle = async(req , res)=>{
    try{
        const {userId} = req.auth();
        const {prompt, length} = req.body;
        const plan = req.plan;
        const free_usage= req.free_usage;

        if(plan!=='premium' && free_usage>=15){
            return res.json({success: false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
        {
            role: "user",
            content: prompt,
        },
    ],
    temperature:0.7,
    max_tokens:length,
});

const content = response.choices[0].message.content

await sql`INSERT INTO creations(user_id, prompt, content , type) 
VALUES (${userId}, ${prompt} ,${content}, 'article')`;

if(plan!=='premium'){
    await clerkClient.users.updateUserMetadata(userId,{
        privateMetadata:{
            free_usage:free_usage+1
        }
    })
}

res.json({success:true, content});

    }catch(error){
        console.log(error.message)
        res.json({success:false, message:error.message})
    }
}

export const generateBlogTitle = async(req , res)=>{
    try{
        const {userId} = req.auth();
        const {prompt} = req.body;
        const plan = req.plan;
        const free_usage= req.free_usage;

        if(plan!=='premium' && free_usage>=15){
            return res.json({success: false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
        {
            role: "user",
            content: prompt,
        },
    ],
    temperature:0.7,
    max_tokens:100,
});

const content = response.choices[0].message.content

await sql `INSERT INTO creations(user_id, prompt, content , type) 
VALUES (${userId}, ${prompt} ,${content}, 'article')`;

if(plan!=='premium'){
    await clerkClient.users.updateUserMetadata(userId,{
        privateMetadata:{
            free_usage:free_usage+1
        }
    })
}

res.json({success:true, content});

    }catch(error){
        console.log(error.message)
        res.json({success:false, message:error.message})
    }
}

export const generateImage= async(req , res)=>{
    try{
        const {userId} = req.auth();
        const {prompt, publish} = req.body;
        const plan = req.plan;

        if(plan !==' premium'){
            return res.json({success: false, message: "This feature is only availabe for premium Subscriptions."})
        }


       const response = await axios.post( 'https://api.openai.com/v1/images/generations',
        {
             prompt,
             model: 'dall-e-3',
             n: 1,
             size: '1024x1024',
             response_format: 'url',
      },
      {
      headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
    }
       )

    //    const base64Image = `data:image/png;base64,${Buffer.from(data , 'binary').toString('base64')}`;
    //    const {secure_url}=await cloudinary.uploader.upload(base64Image)
     const imageUrl = response.data.data[0].url;
      const uploaded = await cloudinary.uploader.upload(imageUrl);

await sql `INSERT INTO creations(user_id, prompt, content , type , publish) 
VALUES (${userId}, ${prompt} ,${uploaded.secure_url}, 'image' , ${publish ?? false})`;

res.json({success:true , content: uploaded.secure_url })

    }catch(error){
         console.error(error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
    }
}

// Optional if uploading to Cloudinary



export const removeImageBackground = async(req , res)=>{
    try{
        const {userId} = req.auth();
        const image = req.file;
        const plan = req.plan;

        if(plan!=='premium'){
            return res.json({success: false, message: "This feature is only availabe for premium Subscriptions."})
        }

      
       const {secure_url}=await cloudinary.uploader.upload(image.path , {
        transformation: [
            {
                effect: 'background_removal',
                background_removal:'remove_the_background'
            }
        ]
       });


await sql `INSERT INTO creations(user_id, prompt, content , type ) 
VALUES (${userId}, 'Remove background from image' ,${secure_url}, 'image')`;

res.json({success: true , content: secure_url })

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}


export const removeImageObject = async(req , res)=>{
    try{
        const {userId} = req.auth();
        const {object} = req.body;
        const image = req.file;
        const plan = req.plan;

        if(plan!=='premium'){
            return res.json({success: false, message: "This feature is only availabe for premium Subscriptions."})
        }

       
       const {public_id} = await cloudinary.uploader.upload(image.path);

       const imageUrl= cloudinary.url(public_id,{
        transformation: [{ effect: `gen_remove:${object}` }],
        resource_type : "image"
       })


await sql `INSERT INTO creations(user_id, prompt, content , type ) 
VALUES (${userId}, ${`Removed ${object} from image`} ,${imageUrl}, 'image')`;

res.json({success: true , content: imageUrl })

    }catch(error){
        console.log(error.message)
        res.json({success:false, message: error.message})
    }
}


// export const resumeReview = async(req , res)=>{
//     try{
//         const {userId} = req.auth();
//         const resume = req.file;
//         const plan = req.plan;

//         if(plan!=='premium'){
//             return res.json({success: false, message: "This feature is only availabe for premium Subscriptions."})
//         }

       
//       if(resume.size > 5 * 1024 * 1024){
//         return res.json({success: false, message:"Resume file size exceeds allowed size (5MB).."})
//       }

//       const dataBuffer =fs.readFileSync(resume.path)
//       const pdfData = await pdf(dataBuffer)

//       const prompt = `
// You are an experienced career coach and professional resume reviewer. Please analyze the resume provided below and give detailed feedback based on the following:

// 1. **Strengths** – Highlight what’s working well (e.g., structure, clarity, relevant content, achievements, formatting).
// 2. **Weaknesses** – Identify specific areas that need improvement (e.g., vague language, missing sections, lack of metrics or details).
// 3. **Suggestions for Improvement** – Provide actionable recommendations to improve impact, readability, and professionalism.
// 4. **Grammar & Tone** – Note any grammatical or stylistic issues that may affect the impression.
// 5. **Overall Impression** – Give a brief summary of how this resume would perform in a competitive job market.

// Resume Content:
// ${pdfData.text}
// `;


//        const response = await AI.chat.completions.create({
//     model: "gemini-2.0-flash",
//     messages: [
//         {
//             role: "user",
//             content: prompt,
//         },
//     ],
//     temperature:0.7,
//     max_tokens:1000,
// });

// const content = response.choices[0].message.content


// await sql `INSERT INTO creations (user_id, prompt, content , type ) 
// VALUES (${userId}, 'Review the uploaded resume' , ${content} , 'resume-review')`;

// res.json({success: true , content })

//     }catch(error){
//         console.log(error.message)
//         res.json({success:false, message: error.message})
//     }
// }




// import { AI } from "../configs/ai.js"; // Your AI config (Gemini/OpenAI)


export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions.",
      });
    }

    if (!resume || resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: "Resume file size exceeds allowed limit (5MB).",
      });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);
    const resumeText = pdfData.text;

    // 🔍 ATS Score Estimation (simple keyword-based logic)
    const atsKeywords = [
      "JavaScript", "React", "Node.js", "SQL", "REST", "MongoDB", "Python",
      "Git", "Agile", "API", "HTML", "CSS", "TypeScript", "Redux", "Express",
      "Team", "Project", "Leadership", "AWS", "Docker", "CI/CD", "Testing"
    ];
    const lowerResume = resumeText.toLowerCase();
    const matchedKeywords = atsKeywords.filter(kw =>
      lowerResume.includes(kw.toLowerCase())
    );
    const atsScore = Math.min(
      100,
      Math.round((matchedKeywords.length / atsKeywords.length) * 100)
    );

    // 🧠 Prompt for AI review
    const prompt = `
You are an experienced career coach and professional resume reviewer.

Based on the resume text provided below, give feedback on:

1. **Strengths**
2. **Weaknesses**
3. **Suggestions for Improvement**
4. **Grammar & Tone**
5. **Overall Impression**

Resume Content:
""" 
${resumeText}
"""
`;

    const response = await AI.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    // Store in DB
    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
    `;

    return res.json({
      success: true,
      atsScore,
      content,
    });

  } catch (error) {
    console.error("Resume review error:", error.message);
    return res.json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};
