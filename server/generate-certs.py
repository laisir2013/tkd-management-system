#!/usr/bin/env python3
"""
Certificate Generator for Taekwondo Exam System
Generates PDF certificates by filling in student data on template pages.

Usage:
  python3 generate-certs.py --exam-id 3 --output /tmp/certs_output.pdf
  python3 generate-certs.py --json '{"students":[...]}' --output /tmp/certs_output.pdf

Template: 10 pages, each for a different belt level
Page mapping:
  Page 1  → black_2dan (黑帶二段/品)
  Page 2  → black (黑帶一段/品)
  Page 3  → red_black (紅黑帶)
  Page 4  → red (紅帶)
  Page 5  → blue_red (藍紅帶)
  Page 6  → blue (藍帶)
  Page 7  → green_blue (綠藍帶)
  Page 8  → green (綠帶)
  Page 9  → yellow_green (黃綠帶)
  Page 10 → yellow (黃帶)
"""

import sys
import json
import argparse
import os
import fitz  # PyMuPDF
import mysql.connector

# Configuration
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), '..', 'cert_template.pdf')
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
FONT_SIZE = 30.0  # slightly smaller than original 34 for better fit

# Belt level to page index mapping (0-based)
BELT_TO_PAGE = {
    'black_2dan': 0,
    'black': 1,
    'red_black': 2,
    'red': 3,
    'blue_red': 4,
    'blue': 5,
    'green_blue': 6,
    'green': 7,
    'yellow_green': 8,
    'yellow': 9,
}

# Chinese belt level names (for the "考生級別" field)
BELT_CHINESE = {
    'yellow': '黃帶',
    'yellow_green': '黃綠帶',
    'green': '綠帶',
    'green_blue': '綠藍帶',
    'blue': '藍帶',
    'blue_red': '藍紅帶',
    'red': '紅帶',
    'red_black': '紅黑帶',
    'black': '黑帶',
    'black_2dan': '黑帶二段',
}

# Text positions per page (Y coordinates differ by page group)
# Group A (pages 1,3,4,9,10 → indices 0,2,3,8,9): name_y=554, level_y=644.8, date_y=735.5
# Group B (pages 2,5,6,7,8 → indices 1,4,5,6,7): name_y=556.9, level_y=647.6, date_y=738.4
PAGE_POSITIONS = {}
for idx in [0, 2, 3, 8, 9]:
    PAGE_POSITIONS[idx] = {
        'name_y': 554.0,
        'level_y': 644.8,
        'date_y': 735.5,
    }
for idx in [1, 4, 5, 6, 7]:
    PAGE_POSITIONS[idx] = {
        'name_y': 556.9,
        'level_y': 647.6,
        'date_y': 738.4,
    }

# X position where fill text starts (after the colon "：")
TEXT_X = 185.0  # just after the colon at x=182.4


def get_db_connection():
    """Connect to MySQL database."""
    return mysql.connector.connect(
        host='localhost',
        user='tkd_user',
        password='tkd_pass_2026',
        database='taekwondo',
        charset='utf8mb4'
    )


def get_exam_candidates(exam_id):
    """Get ALL non-absent candidates for an exam (certificates are prepared before exam)."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get exam info from exam_sessions table
    cursor.execute("SELECT * FROM exam_sessions WHERE id = %s", (exam_id,))
    exam = cursor.fetchone()
    if not exam:
        raise ValueError(f"Exam {exam_id} not found")
    
    exam_date = exam['exam_date'].strftime('%Y-%m-%d') if exam['exam_date'] else ''
    
    # Get ALL non-absent candidates (certificates prepared in advance for everyone)
    # exam_candidates uses: name (直接存), target_belt, current_belt, student_id (nullable)
    cursor.execute("""
        SELECT 
            ec.id,
            ec.student_id,
            ec.target_belt,
            ec.name as student_name
        FROM exam_candidates ec
        WHERE ec.exam_id = %s AND ec.status != 'absent'
        ORDER BY ec.target_belt, ec.name
    """, (exam_id,))
    
    candidates = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return candidates, exam_date


def generate_certificates(students, output_path):
    """
    Generate certificate PDF.
    
    students: list of dicts with keys: name, belt_level (target), exam_date
    output_path: where to save the generated PDF
    """
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")
    
    # Open template
    template_doc = fitz.open(TEMPLATE_PATH)
    
    # Create output document
    output_doc = fitz.open()
    
    # Load font
    if not os.path.exists(FONT_PATH):
        raise FileNotFoundError(f"Font not found: {FONT_PATH}")
    
    for student in students:
        name = student['name']
        belt = student['belt_level']
        date = student['exam_date']
        
        # Find the template page for this belt
        page_idx = BELT_TO_PAGE.get(belt)
        if page_idx is None:
            print(f"WARNING: No template for belt '{belt}', skipping {name}")
            continue
        
        # Copy the template page to output
        output_doc.insert_pdf(template_doc, from_page=page_idx, to_page=page_idx)
        
        # Get the newly inserted page
        new_page = output_doc[-1]
        
        # Get positions for this page
        positions = PAGE_POSITIONS[page_idx]
        
        # Insert text using a font that supports Chinese
        # We use insert_text which supports fontfile parameter
        text_color = (0, 0, 0)  # black
        
        # Insert student name
        new_page.insert_text(
            point=(TEXT_X, positions['name_y'] + FONT_SIZE),  # baseline position
            text=name,
            fontsize=FONT_SIZE,
            fontname="noto",
            fontfile=FONT_PATH,
            color=text_color,
        )
        
        # Insert belt level (Chinese name)
        belt_name = BELT_CHINESE.get(belt, belt)
        new_page.insert_text(
            point=(TEXT_X, positions['level_y'] + FONT_SIZE),
            text=belt_name,
            fontsize=FONT_SIZE,
            fontname="noto",
            fontfile=FONT_PATH,
            color=text_color,
        )
        
        # Insert exam date
        new_page.insert_text(
            point=(TEXT_X, positions['date_y'] + FONT_SIZE),
            text=date,
            fontsize=FONT_SIZE,
            fontname="noto",
            fontfile=FONT_PATH,
            color=text_color,
        )
    
    # Save output with compression (reduces ~200MB to ~15MB for 86 pages)
    output_doc.save(output_path, garbage=4, deflate=True, clean=True)
    output_doc.close()
    template_doc.close()
    
    return len(students)


def main():
    parser = argparse.ArgumentParser(description='Generate Taekwondo Certificates')
    parser.add_argument('--exam-id', type=int, help='Exam ID to generate certificates for')
    parser.add_argument('--json', type=str, help='JSON string with student data')
    parser.add_argument('--json-file', type=str, help='Path to JSON file with student data')
    parser.add_argument('--output', type=str, required=True, help='Output PDF path')
    
    args = parser.parse_args()
    
    if args.exam_id:
        # Get data from database
        candidates, exam_date = get_exam_candidates(args.exam_id)
        students = [{
            'name': c['student_name'],
            'belt_level': c['target_belt'],
            'exam_date': exam_date,
        } for c in candidates]
    elif args.json:
        data = json.loads(args.json)
        students = data if isinstance(data, list) else data.get('students', [])
    elif args.json_file:
        with open(args.json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        students = data if isinstance(data, list) else data.get('students', [])
    else:
        parser.error("Must provide --exam-id, --json, or --json-file")
    
    if not students:
        print(json.dumps({"success": False, "error": "No students to generate certificates for"}))
        sys.exit(1)
    
    count = generate_certificates(students, args.output)
    print(json.dumps({"success": True, "count": count, "output": args.output}))


if __name__ == '__main__':
    main()
