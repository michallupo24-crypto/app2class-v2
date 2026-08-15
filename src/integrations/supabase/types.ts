export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_justifications: {
        Row: {
          attachment_url: string | null
          attendance_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          attachment_url?: string | null
          attendance_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          attachment_url?: string | null
          attendance_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_justifications_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string
          id: string
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_email_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          id: string
          notes: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          required_role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          required_role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          allow_late_submission: boolean | null
          allow_revision: boolean | null
          class_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          max_grade: number | null
          published: boolean | null
          school_id: string
          subject: string
          teacher_id: string
          title: string
          type: Database["public"]["Enums"]["assignment_type"]
          updated_at: string
          weight_percent: number | null
        }
        Insert: {
          allow_late_submission?: boolean | null
          allow_revision?: boolean | null
          class_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_grade?: number | null
          published?: boolean | null
          school_id: string
          subject: string
          teacher_id: string
          title: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
          weight_percent?: number | null
        }
        Update: {
          allow_late_submission?: boolean | null
          allow_revision?: boolean | null
          class_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_grade?: number | null
          published?: boolean | null
          school_id?: string
          subject?: string
          teacher_id?: string
          title?: string
          type?: Database["public"]["Enums"]["assignment_type"]
          updated_at?: string
          weight_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          lesson_id: string
          noted_at: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          noted_at?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          noted_at?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      avatars: {
        Row: {
          accessory: string | null
          background: string
          created_at: string
          expression: string
          eye_color: string
          eye_shape: string
          face_shape: string
          facial_hair: string | null
          hair_color: string
          hair_style: string
          id: string
          outfit: string
          outfit_color: string
          skin_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessory?: string | null
          background?: string
          created_at?: string
          expression?: string
          eye_color?: string
          eye_shape?: string
          face_shape?: string
          facial_hair?: string | null
          hair_color?: string
          hair_style?: string
          id?: string
          outfit?: string
          outfit_color?: string
          skin_color?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessory?: string | null
          background?: string
          created_at?: string
          expression?: string
          eye_color?: string
          eye_shape?: string
          face_shape?: string
          facial_hair?: string | null
          hair_color?: string
          hair_style?: string
          id?: string
          outfit?: string
          outfit_color?: string
          skin_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bell_schedule: {
        Row: {
          break_duration_minutes: number | null
          end_time: string
          id: string
          is_break: boolean
          label: string
          lesson_number: number
          school_id: string
          start_time: string
        }
        Insert: {
          break_duration_minutes?: number | null
          end_time: string
          id?: string
          is_break?: boolean
          label?: string
          lesson_number: number
          school_id: string
          start_time: string
        }
        Update: {
          break_duration_minutes?: number | null
          end_time?: string
          id?: string
          is_break?: boolean
          label?: string
          lesson_number?: number
          school_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_song_suggestions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          school_id: string
          suggested_by: string
          title: string
          youtube_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          school_id: string
          suggested_by: string
          title: string
          youtube_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          school_id?: string
          suggested_by?: string
          title?: string
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_song_suggestions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_song_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_song_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "bell_song_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_safety_events: {
        Row: {
          category: string
          conversation_id: string | null
          created_at: string
          id: string
          message_excerpt: string
          school_id: string
          severity: string
          user_id: string
        }
        Insert: {
          category: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt: string
          school_id: string
          severity?: string
          user_id: string
        }
        Update: {
          category?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt?: string
          school_id?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_safety_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_safety_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_safety_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          id: string
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_syllabus_progress: {
        Row: {
          class_id: string
          completed_at: string | null
          id: string
          notes: string | null
          status: string
          syllabus_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          syllabus_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          syllabus_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_syllabus_progress_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_syllabus_progress_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabi"
            referencedColumns: ["id"]
          },
        ]
      }
      class_announcements: {
        Row: {
          author_id: string
          class_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          is_removed: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          class_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_removed?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          class_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_removed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_number: number
          created_at: string
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          school_id: string
        }
        Insert: {
          class_number: number
          created_at?: string
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          school_id: string
        }
        Update: {
          class_number?: number
          created_at?: string
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          grade: string | null
          id: string
          is_accepted: boolean | null
          school_id: string
          subject: string | null
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by: string
          grade?: string | null
          id?: string
          is_accepted?: boolean | null
          school_id: string
          subject?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          grade?: string | null
          id?: string
          is_accepted?: boolean | null
          school_id?: string
          subject?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      council_candidates: {
        Row: {
          created_at: string
          election_id: string
          id: string
          statement: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          election_id: string
          id?: string
          statement?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          election_id?: string
          id?: string
          statement?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "council_elections"
            referencedColumns: ["id"]
          },
        ]
      }
      council_elections: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          num_seats: number
          school_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          num_seats?: number
          school_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          num_seats?: number
          school_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_elections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      council_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position: string
          school_id: string
          student_id: string
          term_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: string
          school_id: string
          student_id: string
          term_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position?: string
          school_id?: string
          student_id?: string
          term_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      council_votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          voter_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          voter_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "council_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "council_elections"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_cases: {
        Row: {
          counselor_id: string
          created_at: string
          flagged_reason: string | null
          id: string
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          counselor_id: string
          created_at?: string
          flagged_reason?: string | null
          id?: string
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          counselor_id?: string
          created_at?: string
          flagged_reason?: string | null
          id?: string
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselor_cases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_notes: {
        Row: {
          case_id: string
          counselor_id: string
          created_at: string
          id: string
          note_content: string | null
          note_content_encrypted: string | null
        }
        Insert: {
          case_id: string
          counselor_id: string
          created_at?: string
          id?: string
          note_content?: string | null
          note_content_encrypted?: string | null
        }
        Update: {
          case_id?: string
          counselor_id?: string
          created_at?: string
          id?: string
          note_content?: string | null
          note_content_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counselor_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "counselor_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_recommendations: {
        Row: {
          case_id: string
          counselor_id: string
          created_at: string
          id: string
          recommendation_text: string
          teacher_id: string
        }
        Insert: {
          case_id: string
          counselor_id: string
          created_at?: string
          id?: string
          recommendation_text: string
          teacher_id: string
        }
        Update: {
          case_id?: string
          counselor_id?: string
          created_at?: string
          id?: string
          recommendation_text?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselor_recommendations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "counselor_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      event_approvals: {
        Row: {
          approved: boolean | null
          created_at: string
          event_id: string
          id: string
          parent_id: string
          signed_at: string | null
          student_id: string
        }
        Insert: {
          approved?: boolean | null
          created_at?: string
          event_id: string
          id?: string
          parent_id: string
          signed_at?: string | null
          student_id: string
        }
        Update: {
          approved?: boolean | null
          created_at?: string
          event_id?: string
          id?: string
          parent_id?: string
          signed_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_approvals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "grade_events"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_archive: {
        Row: {
          created_at: string
          file_url: string
          grade: Database["public"]["Enums"]["grade_level"] | null
          id: string
          school_id: string
          subject: string
          title: string
          topic: string | null
          uploaded_by: string
          year: number | null
        }
        Insert: {
          created_at?: string
          file_url: string
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          school_id: string
          subject: string
          title: string
          topic?: string | null
          uploaded_by: string
          year?: number | null
        }
        Update: {
          created_at?: string
          file_url?: string
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          school_id?: string
          subject?: string
          title?: string
          topic?: string | null
          uploaded_by?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_archive_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          flowers: number
          id: string
          is_anonymous: boolean
          is_removed: boolean | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          flowers?: number
          id?: string
          is_anonymous?: boolean
          is_removed?: boolean | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          flowers?: number
          id?: string
          is_anonymous?: boolean
          is_removed?: boolean | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "faction_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_members: {
        Row: {
          faction_id: string
          id: string
          joined_at: string
          reputation: number
          role: string
          user_id: string
        }
        Insert: {
          faction_id: string
          id?: string
          joined_at?: string
          reputation?: number
          role?: string
          user_id: string
        }
        Update: {
          faction_id?: string
          id?: string
          joined_at?: string
          reputation?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_members_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      faction_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          faction_id: string
          flowers: number
          id: string
          is_anonymous: boolean
          is_community_pinned: boolean | null
          is_pinned: boolean | null
          is_removed: boolean | null
          removed_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          faction_id: string
          flowers?: number
          id?: string
          is_anonymous?: boolean
          is_community_pinned?: boolean | null
          is_pinned?: boolean | null
          is_removed?: boolean | null
          removed_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          faction_id?: string
          flowers?: number
          id?: string
          is_anonymous?: boolean
          is_community_pinned?: boolean | null
          is_pinned?: boolean | null
          is_removed?: boolean | null
          removed_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faction_posts_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      factions: {
        Row: {
          class_id: string | null
          color: string | null
          created_at: string
          description: string | null
          eligible_roles: string[]
          faction_type: string
          grade: string | null
          icon: string | null
          id: string
          is_sub_faction: boolean | null
          name: string
          parent_faction_id: string | null
          school_id: string
          sub_type: string | null
          subject: string | null
        }
        Insert: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          eligible_roles?: string[]
          faction_type: string
          grade?: string | null
          icon?: string | null
          id?: string
          is_sub_faction?: boolean | null
          name: string
          parent_faction_id?: string | null
          school_id: string
          sub_type?: string | null
          subject?: string | null
        }
        Update: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          eligible_roles?: string[]
          faction_type?: string
          grade?: string | null
          icon?: string | null
          id?: string
          is_sub_faction?: boolean | null
          name?: string
          parent_faction_id?: string | null
          school_id?: string
          sub_type?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factions_parent_faction_id_fkey"
            columns: ["parent_faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string
          id: string
          order_index: number
          question: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          created_by: string
          id?: string
          order_index?: number
          question: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          order_index?: number
          question?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      flower_votes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flower_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "faction_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flower_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "faction_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_reports: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          level: number
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          level: number
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          level?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_reports_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_announcements: {
        Row: {
          announcement_type: string
          content: string
          created_at: string
          created_by: string
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          published: boolean | null
          published_at: string | null
          school_id: string
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          content: string
          created_at?: string
          created_by: string
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          published?: boolean | null
          published_at?: string | null
          school_id: string
          target_audience?: string
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          content?: string
          created_at?: string
          created_by?: string
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          published?: boolean | null
          published_at?: string | null
          school_id?: string
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_events: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          event_end_date: string | null
          event_type: string
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          max_exams_per_week: number | null
          notes: string | null
          proposed_by: string
          rejection_reason: string | null
          requires_parent_approval: boolean | null
          school_id: string
          semester: number | null
          start_time: string | null
          status: string
          subject: string | null
          title: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          event_end_date?: string | null
          event_type?: string
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_exams_per_week?: number | null
          notes?: string | null
          proposed_by: string
          rejection_reason?: string | null
          requires_parent_approval?: boolean | null
          school_id: string
          semester?: number | null
          start_time?: string | null
          status?: string
          subject?: string | null
          title: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_end_date?: string | null
          event_type?: string
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_exams_per_week?: number | null
          notes?: string | null
          proposed_by?: string
          rejection_reason?: string | null
          requires_parent_approval?: boolean | null
          school_id?: string
          semester?: number | null
          start_time?: string | null
          status?: string
          subject?: string | null
          title?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_task_progress: {
        Row: {
          id: string
          last_active_at: string
          score: number | null
          state: Json | null
          status: string
          student_id: string
          submitted_at: string | null
          task_id: string
          time_spent_seconds: number
          total: number | null
        }
        Insert: {
          id?: string
          last_active_at?: string
          score?: number | null
          state?: Json | null
          status?: string
          student_id: string
          submitted_at?: string | null
          task_id: string
          time_spent_seconds?: number
          total?: number | null
        }
        Update: {
          id?: string
          last_active_at?: string
          score?: number | null
          state?: Json | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          task_id?: string
          time_spent_seconds?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interactive_task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "interactive_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_tasks: {
        Row: {
          assignment_id: string | null
          author_id: string
          created_at: string
          css_code: string
          description: string | null
          forked_from: string | null
          grade_level: string | null
          grading_schema: Json | null
          html_code: string
          id: string
          is_public_template: boolean
          js_code: string
          language: string
          libraries: string[]
          mode: string
          python_code: string
          school_id: string | null
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          author_id: string
          created_at?: string
          css_code?: string
          description?: string | null
          forked_from?: string | null
          grade_level?: string | null
          grading_schema?: Json | null
          html_code?: string
          id?: string
          is_public_template?: boolean
          js_code?: string
          language?: string
          libraries?: string[]
          mode?: string
          python_code?: string
          school_id?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          author_id?: string
          created_at?: string
          css_code?: string
          description?: string | null
          forked_from?: string | null
          grade_level?: string | null
          grading_schema?: Json | null
          html_code?: string
          id?: string
          is_public_template?: boolean
          js_code?: string
          language?: string
          libraries?: string[]
          mode?: string
          python_code?: string
          school_id?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_tasks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactive_tasks_forked_from_fkey"
            columns: ["forked_from"]
            isOneToOne: false
            referencedRelation: "interactive_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactive_tasks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          category: Database["public"]["Enums"]["note_category"]
          created_at: string
          id: string
          lesson_id: string
          note: string | null
          student_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["note_category"]
          created_at?: string
          id?: string
          lesson_id: string
          note?: string | null
          student_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["note_category"]
          created_at?: string
          id?: string
          lesson_id?: string
          note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          class_id: string
          created_at: string
          id: string
          lesson_date: string
          lesson_number: number
          school_id: string
          subject: string
          teacher_id: string
          topic: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          lesson_date?: string
          lesson_number?: number
          school_id: string
          subject: string
          teacher_id: string
          topic?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          lesson_date?: string
          lesson_number?: number
          school_id?: string
          subject?: string
          teacher_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      live_poll_responses: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          selected_option: number
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          selected_option: number
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          selected_option?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "live_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      live_polls: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          options: Json
          poll_type: string
          question: string
          session_id: string
          show_results: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json
          poll_type?: string
          question: string
          session_id: string
          show_results?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json
          poll_type?: string
          question?: string
          session_id?: string
          show_results?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "live_polls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_question_votes: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "live_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_questions: {
        Row: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_answered: boolean
          session_id: string
          student_id: string
          upvotes: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          session_id: string
          student_id: string
          upvotes?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          session_id?: string
          student_id?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_active: boolean
          lesson_number: number
          school_id: string
          session_date: string
          shared_content_title: string | null
          shared_content_type: string | null
          shared_content_url: string | null
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          lesson_number: number
          school_id: string
          session_date?: string
          shared_content_title?: string | null
          shared_content_type?: string | null
          shared_content_url?: string | null
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lesson_number?: number
          school_id?: string
          session_date?: string
          shared_content_title?: string | null
          shared_content_type?: string | null
          shared_content_url?: string | null
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          confirmed: boolean | null
          created_at: string
          id: string
          meeting_id: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string
          id?: string
          meeting_id: string
          user_id: string
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string
          id?: string
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "staff_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_slots: {
        Row: {
          booked_by_parent_id: string | null
          class_id: string | null
          created_at: string
          end_time: string
          id: string
          is_booked: boolean
          notes: string | null
          school_id: string
          start_time: string
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          booked_by_parent_id?: string | null
          class_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          is_booked?: boolean
          notes?: string | null
          school_id: string
          start_time: string
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          booked_by_parent_id?: string | null
          class_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_booked?: boolean
          notes?: string | null
          school_id?: string
          start_time?: string
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          flag_reason: string | null
          id: string
          is_flagged: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newspaper_article_likes: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newspaper_article_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "newspaper_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      newspaper_articles: {
        Row: {
          author_id: string
          category: string
          content: string
          cover_image_url: string | null
          created_at: string
          id: string
          likes: number
          published_at: string | null
          school_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          likes?: number
          published_at?: string | null
          school_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          likes?: number
          published_at?: string | null
          school_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newspaper_articles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          school_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          school_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: []
      }
      payment_items: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          grade: Database["public"]["Enums"]["grade_level"] | null
          id: string
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          created_at: string
          id: string
          marked_by: string | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_item_id: string
          payment_method: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_item_id: string
          payment_method?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_item_id?: string
          payment_method?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_payment_item_id_fkey"
            columns: ["payment_item_id"]
            isOneToOne: false
            referencedRelation: "payment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          chat_presence: string
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          id_number: string | null
          id_number_encrypted: string | null
          id_number_hash: string | null
          is_approved: boolean
          phone: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          chat_presence?: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          id_number?: string | null
          id_number_encrypted?: string | null
          id_number_hash?: string | null
          is_approved?: boolean
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          chat_presence?: string
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          id_number?: string | null
          id_number_encrypted?: string | null
          id_number_hash?: string | null
          is_approved?: boolean
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          send_at: string
          sender_id: string
          sent_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          send_at: string
          sender_id: string
          sent_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          send_at?: string
          sender_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          event_type: string | null
          id: string
          is_holiday: boolean | null
          school_id: string | null
          start_date: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          event_type?: string | null
          id?: string
          is_holiday?: boolean | null
          school_id?: string | null
          start_date: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          event_type?: string | null
          id?: string
          is_holiday?: boolean | null
          school_id?: string | null
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      staff_meetings: {
        Row: {
          ai_suggested: boolean | null
          created_at: string
          description: string | null
          end_time: string | null
          grade: Database["public"]["Enums"]["grade_level"] | null
          id: string
          location: string | null
          meeting_date: string
          organized_by: string
          protocol: string | null
          school_id: string
          start_time: string | null
          status: string
          subject: string | null
          suggestion_reason: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_suggested?: boolean | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          location?: string | null
          meeting_date: string
          organized_by: string
          protocol?: string | null
          school_id: string
          start_time?: string | null
          status?: string
          subject?: string | null
          suggestion_reason?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_suggested?: boolean | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          grade?: Database["public"]["Enums"]["grade_level"] | null
          id?: string
          location?: string | null
          meeting_date?: string
          organized_by?: string
          protocol?: string | null
          school_id?: string
          start_time?: string | null
          status?: string
          subject?: string | null
          suggestion_reason?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_meetings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_seats: {
        Row: {
          class_id: string
          col_index: number
          created_at: string
          id: string
          row_index: number
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          col_index: number
          created_at?: string
          id?: string
          row_index: number
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          col_index?: number
          created_at?: string
          id?: string
          row_index?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_seats_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tracks: {
        Row: {
          approved: boolean | null
          approved_by: string | null
          created_at: string
          id: string
          level: string | null
          school_id: string
          track_name: string
          track_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          approved_by?: string | null
          created_at?: string
          id?: string
          level?: string | null
          school_id: string
          track_name: string
          track_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean | null
          approved_by?: string | null
          created_at?: string
          id?: string
          level?: string | null
          school_id?: string
          track_name?: string
          track_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_tracks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          feedback: string | null
          file_url: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          feedback?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          school_id: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabi: {
        Row: {
          created_at: string
          description: string | null
          estimated_hours: number
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          order_index: number
          school_id: string
          subject: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_hours?: number
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          order_index?: number
          school_id: string
          subject: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_hours?: number
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          order_index?: number
          school_id?: string
          subject?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabi_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          school_id: string | null
          severity: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          school_id?: string | null
          severity?: string
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          school_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          school_id: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          school_id?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          school_id?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      task_questions: {
        Row: {
          assignment_id: string
          correct_answer: string | null
          created_at: string
          difficulty: number | null
          explanation: string | null
          id: string
          image_url: string | null
          options: Json | null
          order_num: number
          points: number | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          correct_answer?: string | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          order_num?: number
          points?: number | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          correct_answer?: string | null
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json | null
          order_num?: number
          points?: number | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_homeroom: boolean | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_homeroom?: boolean | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_homeroom?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string | null
          color: string | null
          created_at: string
          day_of_week: number
          group_name: string | null
          id: string
          lesson_number: number
          room: string | null
          school_id: string
          subject: string
          teacher_id: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          day_of_week: number
          group_name?: string | null
          id?: string
          lesson_number: number
          room?: string | null
          school_id: string
          subject: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          day_of_week?: number
          group_name?: string | null
          id?: string
          lesson_number?: number
          room?: string | null
          school_id?: string
          subject?: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_sessions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          grade: Database["public"]["Enums"]["grade_level"]
          id: string
          max_students: number | null
          room: string | null
          school_id: string
          session_date: string
          start_time: string | null
          status: string
          subject: string
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          grade: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_students?: number | null
          room?: string | null
          school_id: string
          session_date: string
          start_time?: string | null
          status?: string
          subject: string
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          grade?: Database["public"]["Enums"]["grade_level"]
          id?: string
          max_students?: number | null
          room?: string | null
          school_id?: string
          session_date?: string
          start_time?: string | null
          status?: string
          subject?: string
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_students: {
        Row: {
          attended: boolean | null
          created_at: string
          id: string
          session_id: string
          student_id: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          id?: string
          session_id: string
          student_id: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_category: string
          badge_icon: string
          badge_key: string
          badge_label: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_category?: string
          badge_icon?: string
          badge_key: string
          badge_label: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_category?: string
          badge_icon?: string
          badge_key?: string
          badge_label?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reliability: {
        Row: {
          id: string
          is_faction_guardian: boolean
          score: number
          total_negative: number
          total_positive: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_faction_guardian?: boolean
          score?: number
          total_negative?: number
          total_positive?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_faction_guardian?: boolean
          score?: number
          total_negative?: number
          total_positive?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          grade: Database["public"]["Enums"]["grade_level"] | null
          homeroom_class_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          subject: string | null
          user_id: string
        }
        Insert: {
          grade?: Database["public"]["Enums"]["grade_level"] | null
          homeroom_class_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          subject?: string | null
          user_id: string
        }
        Update: {
          grade?: Database["public"]["Enums"]["grade_level"] | null
          homeroom_class_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_homeroom_class_id_fkey"
            columns: ["homeroom_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          current_streak: number
          id: string
          last_active_date: string
          longest_streak: number
          total_active_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_active_date?: string
          longest_streak?: number
          total_active_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_active_date?: string
          longest_streak?: number
          total_active_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_meeting_slot: {
        Args: { p_slot_id: string; p_student_id: string }
        Returns: undefined
      }
      bootstrap_school: {
        Args: { p_classes_per_grade?: number; p_school_name: string }
        Returns: string
      }
      can_approve: {
        Args: {
          p_approver_id: string
          p_required_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: boolean
      }
      cancel_meeting_slot: { Args: { p_slot_id: string }; Returns: undefined }
      check_and_award_badge: {
        Args: {
          p_badge_icon: string
          p_badge_key: string
          p_badge_label: string
          p_category: string
          p_user_id: string
        }
        Returns: boolean
      }
      create_notification: {
        Args: {
          p_body?: string
          p_link?: string
          p_school_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      find_student_by_id_number: {
        Args: { p_id_number: string; p_school_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      flag_student_for_counselor: {
        Args: { p_reason?: string; p_student_id: string }
        Returns: number
      }
      get_assignment_averages: {
        Args: { p_assignment_ids: string[] }
        Returns: {
          assignment_id: string
          avg_grade: number
        }[]
      }
      get_class_average: { Args: { p_class_id: string }; Returns: number }
      get_counselor_note: { Args: { p_note_id: string }; Returns: string }
      get_grade_distribution: {
        Args: { p_class_id: string; p_subject: string }
        Returns: {
          bucket_label: string
          bucket_min: number
          student_count: number
        }[]
      }
      get_subject_coordinator_class_count: {
        Args: { p_subject: string }
        Returns: number
      }
      get_subject_coordinator_grade_stats: {
        Args: { p_subject: string }
        Returns: {
          grade: Database["public"]["Enums"]["grade_level"]
          avg_grade: number
          grade_count: number
        }[]
      }
      get_grade_coordinator_class_stats: {
        Args: { p_grade: Database["public"]["Enums"]["grade_level"] }
        Returns: {
          class_id: string
          subject: string
          avg_grade: number
          grade_count: number
        }[]
      }
      get_school_grade_averages: {
        Args: { p_school_id: string }
        Returns: {
          grade: string
          avg_grade: number
          class_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_current_user_approved: { Args: never; Returns: boolean }
      reveal_id_number: { Args: { p_profile_id: string }; Returns: string }
      send_submission_reminders: {
        Args: { p_assignment_id: string }
        Returns: number
      }
      update_user_streak: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "student"
        | "parent"
        | "educator"
        | "professional_teacher"
        | "subject_coordinator"
        | "grade_coordinator"
        | "counselor"
        | "management"
        | "system_admin"
        | "super_admin"
      approval_status: "pending" | "approved" | "rejected"
      assignment_type: "homework" | "exam" | "quiz" | "project" | "exercise"
      attendance_status: "present" | "absent" | "late" | "excused"
      grade_level: "ז" | "ח" | "ט" | "י" | "יא" | "יב"
      note_category:
        | "disruption"
        | "phone"
        | "disrespect"
        | "no_equipment"
        | "no_homework"
        | "positive_participation"
        | "helped_peer"
        | "excellence"
      question_type:
        | "multiple_choice"
        | "open"
        | "true_false"
        | "fill_blank"
        | "matching"
      submission_status:
        | "draft"
        | "submitted"
        | "graded"
        | "revision_needed"
        | "revised"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "student",
        "parent",
        "educator",
        "professional_teacher",
        "subject_coordinator",
        "grade_coordinator",
        "counselor",
        "management",
        "system_admin",
        "super_admin",
      ],
      approval_status: ["pending", "approved", "rejected"],
      assignment_type: ["homework", "exam", "quiz", "project", "exercise"],
      attendance_status: ["present", "absent", "late", "excused"],
      grade_level: ["ז", "ח", "ט", "י", "יא", "יב"],
      note_category: [
        "disruption",
        "phone",
        "disrespect",
        "no_equipment",
        "no_homework",
        "positive_participation",
        "helped_peer",
        "excellence",
      ],
      question_type: [
        "multiple_choice",
        "open",
        "true_false",
        "fill_blank",
        "matching",
      ],
      submission_status: [
        "draft",
        "submitted",
        "graded",
        "revision_needed",
        "revised",
      ],
    },
  },
} as const
