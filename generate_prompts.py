import json
import os
import sys

def parse_transcript(conversation_id, output_file):
    brain_dir = "/Users/shreeshaanandpujar/.gemini/antigravity-ide/brain"
    transcript_path = os.path.join(brain_dir, conversation_id, ".system_generated", "logs", "transcript.jsonl")
    
    if not os.path.exists(transcript_path):
        # Try transcript_full.jsonl
        transcript_path = os.path.join(brain_dir, conversation_id, ".system_generated", "logs", "transcript_full.jsonl")
        if not os.path.exists(transcript_path):
            print(f"Error: Transcript not found for conversation {conversation_id}")
            return False

    print(f"Parsing transcript from: {transcript_path}")
    
    prompts = []
    
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                source = data.get("source")
                step_type = data.get("type")
                content = data.get("content", "")
                
                # Clean up metadata from user requests
                if source == "USER_EXPLICIT" or step_type == "USER_INPUT":
                    # Remove the metadata like <ADDITIONAL_METADATA>...
                    if "<USER_REQUEST>" in content:
                        start = content.find("<USER_REQUEST>") + len("<USER_REQUEST>")
                        end = content.find("</USER_REQUEST>")
                        if end != -1:
                            content = content[start:end].strip()
                    prompts.append({
                        "role": "User",
                        "content": content
                    })
                elif source == "MODEL" and content:
                    prompts.append({
                        "role": "Agent",
                        "content": content
                    })
            except Exception as e:
                # Skip invalid lines
                continue
                
    # Write to Markdown
    with open(output_file, "w", encoding="utf-8") as out:
        out.write(f"# AI Usage Log & Prompt History\n\n")
        out.write(f"This log contains the prompts and model responses for conversation `{conversation_id}`.\n\n")
        
        for idx, item in enumerate(prompts):
            role = item["role"]
            content = item["content"].strip()
            if not content:
                continue
            out.write(f"## {idx + 1}. {role}\n\n")
            out.write(f"{content}\n\n")
            out.write("---\n\n")
            
    print(f"Successfully generated {output_file}!")
    return True

if __name__ == "__main__":
    # Default to the main hackathon conversation ID
    default_id = "46106c7d-ced5-4dcd-9226-fa665615dc2b"
    conv_id = sys.argv[1] if len(sys.argv) > 1 else default_id
    output_path = "/Users/shreeshaanandpujar/.gemini/antigravity-ide/scratch/autonomous-agent/PROMPTS.md"
    parse_transcript(conv_id, output_path)
