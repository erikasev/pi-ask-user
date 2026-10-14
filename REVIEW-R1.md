Proposed additional test cases                                                 
                                                                                
 1. No-options invalid — dialog never opens                                     
     - Input / Dialog: { question: "", reason: "need info" } with a fake Dialog 
       where hasUI: true and input is tracked.                                  
     - Expected: status === "invalid", error present, input is never called.    
     - Why it matters: Acceptance criteria require that invalid params return   
       invalid without opening any dialog; this must hold for the no-options    
       branch too.                                                              
                                                                                
 2. Invalid params beat unavailable UI                                          
     - Input / Dialog: { question: "", reason: "" } with hasUI: false and both  
       select/input instrumented to throw if called.                            
     - Expected: status === "invalid" (not "unavailable"), neither dialog       
       method is invoked.                                                       
     - Why it matters: The decision tree in PLAN B1 validates before checking   
       hasUI. If the implementation ever swaps that order, an invalid call      
       could be swallowed as unavailable.                                       
                                                                                
 3. Exact title formatting (no-options)                                         
     - Input / Dialog: { question: "Q", reason: "R" } with input captured.      
     - Expected: The title string passed to input is exactly "Q\n\nR".          
     - Why it matters: README and PLAN specify the presentation format;         
       toContain lets bugs like missing newlines or extra spaces pass.          
                                                                                
 4. Exact title formatting with recommended                                     
     - Input / Dialog: Options path with recommended: "Blue", capture select    
       title.                                                                   
     - Expected: title is exactly "Which color?\n\nCannot decide without        
       you.\n\nRecommended: Blue".                                              
     - Why it matters: The PLAN B1 explicitly appends "\n\nRecommended: ...";   
       partial assertions don’t prevent concatenation errors.                   
                                                                                
 5. Title passed to input after choosing “Other”                                
     - Input / Dialog: Options path. Fake select returns "Other (type your own  
       answer)"; capture the title passed to input.                             
     - Expected: input title contains both question and reason (ideally exactly 
       the same title shown in select).                                         
     - Why it matters: The spec says choosing Other opens ctx.ui.input; the     
       user still needs the question context. The current test only tracks      
       type, not the title parameter.                                           
                                                                                
 6. Blank answer as empty string "" (no-options)                                
     - Input / Dialog: No-options path, fake input returns "".                  
     - Expected: status === "empty".                                            
     - Why it matters: “Blank” includes both whitespace-only and the empty      
       string. Tests should cover the literal boundary.                         
                                                                                
 7. Blank answer as empty string "" after “Other”                               
     - Input / Dialog: Options path. select → "Other (type your own answer)";   
       input returns "".                                                        
     - Expected: status === "empty".                                            
     - Why it matters: Same empty-string boundary as #6, but through the        
       two-step flow where blank custom input is a distinct user action.        
                                                                                
 8. User contradicts recommendation by typing the recommended label as custom   
    text                                                                        
     - Input / Dialog: Options ["Red", "Green", "Blue"], recommended: "Blue".   
       Fake select → Other; input returns "Blue".                               
     - Expected: status === "custom", answer === "Blue".                        
     - Why it matters: Guards against an implementation that auto-converts a    
       custom-typed match back to selected. The spec says custom is any typed   
       answer; the user may deliberately type the recommended option to reject  
       the framing or add nuance.                                               
                                                                                
 9. Result shape hygiene for every status                                       
     - Input / Dialog: One test per AskStatus (selected, custom, cancelled,     
       empty, unavailable, invalid).                                            
     - Expected:                                                                
         - selected / custom → answer present, error absent.                    
         - cancelled / empty / unavailable → answer absent, error absent.       
         - invalid → error present, answer absent.                              
     - Why it matters: Leaked fields (e.g., an answer on invalid) would break   
       downstream model-facing formatting in src/index.ts.                      
                                                                                
 10. Validation rejects recommended when options is absent                      
     - Input: { question: "q", reason: "r", recommended: "A" }.                 
     - Expected: status === "invalid", error containing recommended (or         
       options).                                                                
     - Why it matters: The spec says “recommended: must be one of options”. If  
       options are missing, recommended is meaningless and should fail          
       validation rather than being silently ignored.                           
                                                                                
 11. Minimum-size valid options boundary                                        
     - Input: { question: "q", reason: "r", options: ["A", "B"] }.              
     - Expected: status === "ok", params returned unchanged.                    
     - Why it matters: The rule is “at least 2”; the suite only tests below the 
       boundary (["only-one"]). A boundary test protects against off-by-one     
       errors.                                                                  
                                                                                
 12. Options with non-string or non-array runtime values                        
     - Input: { question: "q", reason: "r", options: "not-an-array" } and {     
       question: "q", reason: "r", options: ["A", 123] }.                       
     - Expected: Both return status === "invalid".                              
     - Why it matters: validateAskParams receives unknown. Without defensive    
       type checks, runtime objects could cause find/includes crashes or        
       misleading ok results.   