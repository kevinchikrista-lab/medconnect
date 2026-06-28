export const ICD10 = [
  // A00-A09 Intestinal infectious diseases
  { code: 'A00.9', name: 'Kolera', name_id: 'Kolera, tidak spesifik' },
  { code: 'A01.0', name: 'Typhoid fever', name_id: 'Demam Tifoid' },
  { code: 'A01.4', name: 'Paratyphoid fever', name_id: 'Demam Paratifoid' },
  { code: 'A02.0', name: 'Salmonella enteritis', name_id: 'Enteritis Salmonella' },
  { code: 'A04.7', name: 'Enterocolitis due to C. difficile', name_id: 'Enterokolitis C. difficile' },
  { code: 'A05.9', name: 'Bacterial foodborne intoxication', name_id: 'Keracunan Makanan Bakteri' },
  { code: 'A06.0', name: 'Acute amoebic dysentery', name_id: 'Disentri Amuba Akut' },
  { code: 'A06.9', name: 'Amoebiasis', name_id: 'Amoebiasis' },
  { code: 'A08.0', name: 'Rotaviral enteritis', name_id: 'Enteritis Rotavirus' },
  { code: 'A09', name: 'Infectious gastroenteritis and colitis', name_id: 'Gastroenteritis & Kolitis Infeksi (Diare Akut)' },

  // A15-A19 Tuberculosis
  { code: 'A15.0', name: 'Tuberculosis of lung', name_id: 'Tuberkulosis Paru' },
  { code: 'A16.9', name: 'Respiratory tuberculosis unspecified', name_id: 'TB Paru Tidak Spesifik' },

  // A30-A49 Other bacterial diseases
  { code: 'A37.9', name: 'Whooping cough', name_id: 'Pertusis (Batuk Rejan)' },
  { code: 'A38', name: 'Scarlet fever', name_id: 'Scarlet Fever' },
  { code: 'A46', name: 'Erysipelas', name_id: 'Erisipelas' },
  { code: 'A49.0', name: 'Staphylococcal infection', name_id: 'Infeksi Stafilokokus' },

  // A50-A64 STI
  { code: 'A54.9', name: 'Gonococcal infection', name_id: 'Infeksi Gonokokus (GO)' },
  { code: 'A60.0', name: 'Herpes simplex infection of genitalia', name_id: 'Herpes Genital' },

  // A80-A89 Viral infections of CNS
  { code: 'A86', name: 'Unspecified viral encephalitis', name_id: 'Ensefalitis Virus' },
  { code: 'A87.9', name: 'Viral meningitis', name_id: 'Meningitis Virus' },
  { code: 'A90', name: 'Dengue fever', name_id: 'Demam Dengue' },
  { code: 'A91', name: 'Dengue haemorrhagic fever', name_id: 'Demam Berdarah Dengue (DBD)' },

  // B00-B09 Viral infections with skin/mucous lesions
  { code: 'B00.1', name: 'Herpes simplex vesicular dermatitis', name_id: 'Herpes Simpleks Kulit' },
  { code: 'B00.9', name: 'Herpes simplex infection', name_id: 'Infeksi Herpes Simpleks' },
  { code: 'B01.9', name: 'Varicella (chickenpox)', name_id: 'Varisela (Cacar Air)' },
  { code: 'B02.9', name: 'Herpes zoster', name_id: 'Herpes Zoster' },
  { code: 'B05.9', name: 'Measles', name_id: 'Campak (Measles)' },
  { code: 'B06.9', name: 'Rubella', name_id: 'Rubella' },
  { code: 'B07', name: 'Viral warts', name_id: 'Kutil Virus (Veruka Vulgaris)' },
  { code: 'B08.1', name: 'Molluscum contagiosum', name_id: 'Moluskum Kontagiosum' },
  { code: 'B08.4', name: 'Hand foot and mouth disease', name_id: 'Penyakit Tangan Kaki Mulut (HFMD)' },

  // B15-B19 Viral hepatitis
  { code: 'B15.9', name: 'Hepatitis A', name_id: 'Hepatitis A' },
  { code: 'B16.9', name: 'Hepatitis B', name_id: 'Hepatitis B Akut' },
  { code: 'B17.1', name: 'Hepatitis C', name_id: 'Hepatitis C Akut' },
  { code: 'B18.1', name: 'Chronic viral hepatitis B', name_id: 'Hepatitis B Kronis' },

  // B25-B34 Other viral diseases
  { code: 'B26.9', name: 'Mumps', name_id: 'Parotitis (Gondongan)' },
  { code: 'B27.9', name: 'Infectious mononucleosis', name_id: 'Mononukleosis Infeksiosa' },
  { code: 'B34.9', name: 'Viral infection unspecified', name_id: 'Infeksi Virus Tidak Spesifik' },

  // B35-B49 Mycoses
  { code: 'B35.0', name: 'Tinea barbae and tinea capitis', name_id: 'Tinea Kapitis' },
  { code: 'B35.1', name: 'Tinea unguium (onychomycosis)', name_id: 'Onikomikosis (Jamur Kuku)' },
  { code: 'B35.3', name: 'Tinea pedis', name_id: 'Tinea Pedis (Kutu Air)' },
  { code: 'B35.4', name: 'Tinea corporis', name_id: 'Tinea Korporis (Kurap)' },
  { code: 'B35.6', name: 'Tinea cruris', name_id: 'Tinea Kruris' },
  { code: 'B36.0', name: 'Pityriasis versicolor', name_id: 'Panu (Pityriasis Versikolor)' },
  { code: 'B37.0', name: 'Candidal stomatitis (oral thrush)', name_id: 'Kandidiasis Oral (Sariawan Jamur)' },
  { code: 'B37.3', name: 'Candidiasis of vulva and vagina', name_id: 'Kandidiasis Vulvovaginal' },

  // B65-B83 Helminthiases
  { code: 'B77.9', name: 'Ascariasis', name_id: 'Askariasis (Cacingan)' },
  { code: 'B80', name: 'Enterobiasis', name_id: 'Enterobiasis (Cacing Kremi)' },
  { code: 'B82.9', name: 'Intestinal helminthiasis', name_id: 'Kecacingan Usus' },
  { code: 'B86', name: 'Scabies', name_id: 'Skabies (Kudis)' },
  { code: 'B85.0', name: 'Pediculosis capitis', name_id: 'Kutu Kepala' },

  // D50-D64 Anaemias
  { code: 'D50.9', name: 'Iron deficiency anaemia', name_id: 'Anemia Defisiensi Besi' },
  { code: 'D53.9', name: 'Nutritional anaemia', name_id: 'Anemia Nutrisional' },
  { code: 'D64.9', name: 'Anaemia unspecified', name_id: 'Anemia Tidak Spesifik' },

  // E00-E07 Thyroid
  { code: 'E03.9', name: 'Hypothyroidism', name_id: 'Hipotiroidisme' },
  { code: 'E05.9', name: 'Thyrotoxicosis (Hyperthyroidism)', name_id: 'Hipertiroidisme' },

  // E10-E14 Diabetes mellitus
  { code: 'E10.9', name: 'Type 1 diabetes mellitus', name_id: 'Diabetes Mellitus Tipe 1' },
  { code: 'E11.9', name: 'Type 2 diabetes mellitus', name_id: 'Diabetes Mellitus Tipe 2' },
  { code: 'E11.65', name: 'Type 2 DM with hyperglycemia', name_id: 'DM Tipe 2 dengan Hiperglikemia' },
  { code: 'E13.9', name: 'Other specified diabetes mellitus', name_id: 'DM Spesifik Lainnya' },

  // E40-E68 Nutritional
  { code: 'E44.1', name: 'Mild protein-energy malnutrition', name_id: 'Malnutrisi Ringan' },
  { code: 'E46', name: 'Protein-energy malnutrition unspecified', name_id: 'Malnutrisi Energi Protein' },
  { code: 'E55.9', name: 'Vitamin D deficiency', name_id: 'Defisiensi Vitamin D' },
  { code: 'E56.0', name: 'Vitamin E deficiency', name_id: 'Defisiensi Vitamin E' },
  { code: 'E61.1', name: 'Iron deficiency', name_id: 'Defisiensi Besi' },
  { code: 'E66.9', name: 'Obesity', name_id: 'Obesitas' },

  // E78 Disorders of lipoprotein
  { code: 'E78.0', name: 'Pure hypercholesterolaemia', name_id: 'Hiperkolesterolemia' },
  { code: 'E78.1', name: 'Pure hypertriglyceridaemia', name_id: 'Hipertrigliseridemia' },
  { code: 'E78.5', name: 'Dyslipidaemia unspecified', name_id: 'Dislipidemia' },
  { code: 'E79.0', name: 'Hyperuricaemia', name_id: 'Hiperurisemia (Asam Urat Tinggi)' },

  // F00-F99 Mental and behavioural
  { code: 'F10.1', name: 'Alcohol abuse', name_id: 'Penyalahgunaan Alkohol' },
  { code: 'F32.9', name: 'Depressive episode', name_id: 'Episode Depresi' },
  { code: 'F41.0', name: 'Panic disorder', name_id: 'Gangguan Panik' },
  { code: 'F41.1', name: 'Generalized anxiety disorder', name_id: 'Gangguan Cemas Menyeluruh (GAD)' },
  { code: 'F41.9', name: 'Anxiety disorder unspecified', name_id: 'Gangguan Cemas' },
  { code: 'F43.0', name: 'Acute stress reaction', name_id: 'Reaksi Stres Akut' },
  { code: 'F51.0', name: 'Insomnia', name_id: 'Insomnia' },

  // G43-G44 Headache
  { code: 'G43.9', name: 'Migraine unspecified', name_id: 'Migrain' },
  { code: 'G44.1', name: 'Vascular headache', name_id: 'Nyeri Kepala Vaskular' },
  { code: 'G44.2', name: 'Tension-type headache', name_id: 'Nyeri Kepala Tegang (Tension Headache)' },

  // G50-G59 Nerve disorders
  { code: 'G51.0', name: "Bell's palsy", name_id: "Bell's Palsy" },

  // H00-H06 Eye disorders
  { code: 'H00.0', name: 'Hordeolum (Stye)', name_id: 'Hordeolum (Bintitan)' },
  { code: 'H01.0', name: 'Blepharitis', name_id: 'Blefaritis' },
  { code: 'H04.3', name: 'Acute dacryocystitis', name_id: 'Dakriosistitis Akut' },
  { code: 'H10.0', name: 'Mucopurulent conjunctivitis', name_id: 'Konjungtivitis Mukopurulen' },
  { code: 'H10.1', name: 'Acute atopic conjunctivitis', name_id: 'Konjungtivitis Alergi Akut' },
  { code: 'H10.9', name: 'Conjunctivitis unspecified', name_id: 'Konjungtivitis' },
  { code: 'H25.9', name: 'Senile cataract', name_id: 'Katarak Senilis' },
  { code: 'H52.1', name: 'Myopia', name_id: 'Miopia (Rabun Jauh)' },

  // H60-H95 Ear disorders
  { code: 'H60.9', name: 'Otitis externa', name_id: 'Otitis Eksterna' },
  { code: 'H65.9', name: 'Nonsuppurative otitis media', name_id: 'Otitis Media Non-Supuratif' },
  { code: 'H66.9', name: 'Suppurative otitis media', name_id: 'Otitis Media Supuratif' },
  { code: 'H81.1', name: 'Benign paroxysmal positional vertigo', name_id: 'BPPV (Vertigo Posisional)' },
  { code: 'H81.9', name: 'Vestibular disorder (Vertigo)', name_id: 'Vertigo' },

  // I10-I15 Hypertensive diseases
  { code: 'I10', name: 'Essential (primary) hypertension', name_id: 'Hipertensi Primer (Esensial)' },
  { code: 'I11.9', name: 'Hypertensive heart disease', name_id: 'Penyakit Jantung Hipertensi' },

  // I20-I25 Ischaemic heart diseases
  { code: 'I20.9', name: 'Angina pectoris', name_id: 'Angina Pektoris' },
  { code: 'I21.9', name: 'Acute myocardial infarction', name_id: 'Infark Miokard Akut' },
  { code: 'I25.9', name: 'Chronic ischaemic heart disease', name_id: 'Penyakit Jantung Iskemik Kronis' },

  // I47-I49 Cardiac arrhythmias
  { code: 'I49.9', name: 'Cardiac arrhythmia', name_id: 'Aritmia Jantung' },

  // I63-I69 Cerebrovascular
  { code: 'I63.9', name: 'Cerebral infarction', name_id: 'Stroke Iskemik' },
  { code: 'I64', name: 'Stroke not specified', name_id: 'Stroke' },

  // I83-I87 Venous
  { code: 'I83.9', name: 'Varicose veins of lower extremities', name_id: 'Varises Tungkai' },
  { code: 'I84.9', name: 'Haemorrhoids', name_id: 'Wasir (Hemoroid)' },

  // J00-J06 Acute upper respiratory infections
  { code: 'J00', name: 'Acute nasopharyngitis (common cold)', name_id: 'Common Cold (Pilek)' },
  { code: 'J01.9', name: 'Acute sinusitis', name_id: 'Sinusitis Akut' },
  { code: 'J02.0', name: 'Streptococcal pharyngitis', name_id: 'Faringitis Streptokokus' },
  { code: 'J02.9', name: 'Acute pharyngitis', name_id: 'Faringitis Akut (Radang Tenggorokan)' },
  { code: 'J03.9', name: 'Acute tonsillitis', name_id: 'Tonsilitis Akut (Radang Amandel)' },
  { code: 'J04.0', name: 'Acute laryngitis', name_id: 'Laringitis Akut' },
  { code: 'J06.9', name: 'Acute upper respiratory infection', name_id: 'ISPA (Infeksi Saluran Napas Atas)' },

  // J09-J18 Influenza and pneumonia
  { code: 'J09', name: 'Influenza due to identified virus', name_id: 'Influenza (Flu)' },
  { code: 'J10.1', name: 'Influenza with other respiratory manifestations', name_id: 'Influenza dengan Gejala Respiratori' },
  { code: 'J11.1', name: 'Influenza with other manifestations, virus not identified', name_id: 'Influenza Virus Tidak Teridentifikasi' },
  { code: 'J15.9', name: 'Bacterial pneumonia', name_id: 'Pneumonia Bakteri' },
  { code: 'J18.9', name: 'Pneumonia unspecified', name_id: 'Pneumonia' },

  // J20-J22 Lower respiratory infections
  { code: 'J20.9', name: 'Acute bronchitis', name_id: 'Bronkitis Akut' },
  { code: 'J21.9', name: 'Acute bronchiolitis', name_id: 'Bronkiolitis Akut' },
  { code: 'J22', name: 'Unspecified acute lower respiratory infection', name_id: 'Infeksi Saluran Napas Bawah Akut' },

  // J30-J39 Other diseases of URT
  { code: 'J30.1', name: 'Allergic rhinitis due to pollen', name_id: 'Rinitis Alergi Pollen' },
  { code: 'J30.4', name: 'Allergic rhinitis unspecified', name_id: 'Rinitis Alergi' },
  { code: 'J31.0', name: 'Chronic rhinitis', name_id: 'Rinitis Kronis' },
  { code: 'J32.9', name: 'Chronic sinusitis', name_id: 'Sinusitis Kronis' },
  { code: 'J35.0', name: 'Chronic tonsillitis', name_id: 'Tonsilitis Kronis' },

  // J40-J47 Chronic lower respiratory
  { code: 'J40', name: 'Bronchitis NOS', name_id: 'Bronkitis' },
  { code: 'J42', name: 'Chronic bronchitis unspecified', name_id: 'Bronkitis Kronis' },
  { code: 'J44.1', name: 'COPD with acute exacerbation', name_id: 'PPOK Eksaserbasi Akut' },
  { code: 'J44.9', name: 'COPD unspecified', name_id: 'PPOK (Penyakit Paru Obstruktif Kronis)' },
  { code: 'J45.9', name: 'Asthma', name_id: 'Asma Bronkial' },

  // K00-K14 Oral cavity
  { code: 'K02.9', name: 'Dental caries', name_id: 'Karies Gigi' },
  { code: 'K04.0', name: 'Pulpitis', name_id: 'Pulpitis (Radang Saraf Gigi)' },
  { code: 'K05.0', name: 'Acute gingivitis', name_id: 'Gingivitis Akut (Radang Gusi)' },
  { code: 'K08.1', name: 'Loss of teeth', name_id: 'Kehilangan Gigi' },
  { code: 'K12.0', name: 'Recurrent oral aphthae', name_id: 'Stomatitis Aftosa (Sariawan)' },

  // K20-K31 Oesophagus, stomach, duodenum
  { code: 'K21.0', name: 'GERD with oesophagitis', name_id: 'GERD dengan Esofagitis' },
  { code: 'K21.9', name: 'GERD without oesophagitis', name_id: 'GERD (Asam Lambung Naik)' },
  { code: 'K25.9', name: 'Gastric ulcer', name_id: 'Tukak Lambung' },
  { code: 'K26.9', name: 'Duodenal ulcer', name_id: 'Tukak Duodenum' },
  { code: 'K29.1', name: 'Other acute gastritis', name_id: 'Gastritis Akut' },
  { code: 'K29.5', name: 'Chronic gastritis', name_id: 'Gastritis Kronis' },
  { code: 'K29.7', name: 'Gastritis unspecified', name_id: 'Gastritis' },
  { code: 'K30', name: 'Functional dyspepsia', name_id: 'Dispepsia Fungsional' },

  // K35-K38 Appendix
  { code: 'K35.9', name: 'Acute appendicitis', name_id: 'Apendisitis Akut (Usus Buntu)' },

  // K40-K46 Hernia
  { code: 'K40.9', name: 'Inguinal hernia', name_id: 'Hernia Inguinalis' },

  // K50-K52 Noninfective enteritis and colitis
  { code: 'K52.9', name: 'Noninfective gastroenteritis and colitis', name_id: 'Gastroenteritis Non-Infeksi' },

  // K56-K63 Other intestinal
  { code: 'K58.9', name: 'Irritable bowel syndrome', name_id: 'Sindrom Iritasi Usus Besar (IBS)' },
  { code: 'K59.0', name: 'Constipation', name_id: 'Konstipasi (Sembelit)' },

  // K70-K77 Liver
  { code: 'K76.0', name: 'Fatty liver', name_id: 'Perlemakan Hati (Fatty Liver)' },

  // L00-L08 Infections of skin
  { code: 'L01.0', name: 'Impetigo', name_id: 'Impetigo' },
  { code: 'L02.9', name: 'Cutaneous abscess, furuncle and carbuncle', name_id: 'Abses / Bisul (Furunkel)' },
  { code: 'L03.9', name: 'Cellulitis', name_id: 'Selulitis' },
  { code: 'L08.0', name: 'Pyoderma', name_id: 'Pioderma' },

  // L20-L30 Dermatitis and eczema
  { code: 'L20.9', name: 'Atopic dermatitis', name_id: 'Dermatitis Atopik (Eksim)' },
  { code: 'L23.9', name: 'Allergic contact dermatitis', name_id: 'Dermatitis Kontak Alergi' },
  { code: 'L24.9', name: 'Irritant contact dermatitis', name_id: 'Dermatitis Kontak Iritan' },
  { code: 'L25.9', name: 'Contact dermatitis unspecified', name_id: 'Dermatitis Kontak' },
  { code: 'L27.0', name: 'Drug eruption', name_id: 'Erupsi Obat' },
  { code: 'L29.9', name: 'Pruritus unspecified', name_id: 'Pruritus (Gatal-Gatal)' },
  { code: 'L30.9', name: 'Dermatitis unspecified', name_id: 'Dermatitis' },

  // L40-L45 Papulosquamous
  { code: 'L40.9', name: 'Psoriasis', name_id: 'Psoriasis' },

  // L50-L54 Urticaria
  { code: 'L50.0', name: 'Allergic urticaria', name_id: 'Urtikaria Alergi (Biduran)' },
  { code: 'L50.9', name: 'Urticaria unspecified', name_id: 'Urtikaria' },

  // L60-L75 Skin appendages
  { code: 'L60.0', name: 'Ingrowing nail', name_id: 'Cantengan (Kuku Tumbuh ke Dalam)' },
  { code: 'L65.9', name: 'Nonscarring hair loss', name_id: 'Kerontokan Rambut' },
  { code: 'L70.0', name: 'Acne vulgaris', name_id: 'Jerawat (Akne Vulgaris)' },
  { code: 'L72.0', name: 'Epidermal cyst', name_id: 'Kista Epidermal' },
  { code: 'L73.2', name: 'Hidradenitis suppurativa', name_id: 'Hidradenitis Supurativa' },

  // M00-M25 Arthropathies
  { code: 'M06.9', name: 'Rheumatoid arthritis', name_id: 'Artritis Reumatoid' },
  { code: 'M10.9', name: 'Gout', name_id: 'Gout (Asam Urat / Pirai)' },
  { code: 'M13.9', name: 'Arthritis unspecified', name_id: 'Artritis' },
  { code: 'M17.9', name: 'Gonarthrosis (knee)', name_id: 'Osteoartritis Lutut' },
  { code: 'M19.9', name: 'Arthrosis unspecified', name_id: 'Osteoartritis' },
  { code: 'M23.9', name: 'Internal derangement of knee', name_id: 'Gangguan Internal Lutut' },
  { code: 'M25.5', name: 'Joint pain', name_id: 'Nyeri Sendi (Artralgia)' },

  // M40-M54 Dorsopathies
  { code: 'M47.9', name: 'Spondylosis', name_id: 'Spondilosis' },
  { code: 'M51.1', name: 'Lumbar disc disorder with radiculopathy', name_id: 'HNP Lumbal' },
  { code: 'M54.2', name: 'Cervicalgia', name_id: 'Nyeri Leher (Servikalgia)' },
  { code: 'M54.5', name: 'Low back pain', name_id: 'Nyeri Punggung Bawah (LBP)' },
  { code: 'M54.9', name: 'Dorsalgia unspecified', name_id: 'Nyeri Punggung' },

  // M60-M79 Soft tissue
  { code: 'M62.8', name: 'Other specified disorders of muscle', name_id: 'Gangguan Otot' },
  { code: 'M65.9', name: 'Synovitis and tenosynovitis', name_id: 'Tenosinovitis' },
  { code: 'M70.4', name: 'Prepatellar bursitis', name_id: 'Bursitis Prepatelar' },
  { code: 'M72.0', name: 'Palmar fascial fibromatosis', name_id: 'Trigger Finger' },
  { code: 'M75.1', name: 'Rotator cuff syndrome', name_id: 'Sindrom Rotator Cuff' },
  { code: 'M77.1', name: 'Lateral epicondylitis (Tennis elbow)', name_id: 'Tennis Elbow' },
  { code: 'M79.1', name: 'Myalgia', name_id: 'Mialgia (Nyeri Otot)' },
  { code: 'M79.3', name: 'Panniculitis', name_id: 'Panikulitis' },

  // N10-N16 Renal tubulo-interstitial
  { code: 'N10', name: 'Acute pyelonephritis', name_id: 'Pielonefritis Akut' },
  { code: 'N18.9', name: 'Chronic kidney disease', name_id: 'Penyakit Ginjal Kronis (CKD)' },
  { code: 'N20.0', name: 'Calculus of kidney', name_id: 'Batu Ginjal' },
  { code: 'N20.1', name: 'Calculus of ureter', name_id: 'Batu Ureter' },

  // N30 Cystitis
  { code: 'N30.0', name: 'Acute cystitis', name_id: 'Sistitis Akut (Infeksi Saluran Kemih)' },
  { code: 'N39.0', name: 'Urinary tract infection', name_id: 'ISK (Infeksi Saluran Kemih)' },

  // N40-N51 Male genital
  { code: 'N40', name: 'Benign prostatic hyperplasia', name_id: 'BPH (Pembesaran Prostat Jinak)' },

  // N70-N77 Female pelvic inflammatory
  { code: 'N72', name: 'Inflammatory disease of cervix uteri', name_id: 'Servisitis' },
  { code: 'N76.0', name: 'Acute vaginitis', name_id: 'Vaginitis Akut' },
  { code: 'N91.2', name: 'Amenorrhoea unspecified', name_id: 'Amenorea' },
  { code: 'N92.0', name: 'Excessive menstruation', name_id: 'Menorrhagia' },
  { code: 'N94.6', name: 'Dysmenorrhoea unspecified', name_id: 'Dismenore (Nyeri Haid)' },

  // R00-R09 Symptoms circulatory/respiratory
  { code: 'R05', name: 'Cough', name_id: 'Batuk' },
  { code: 'R06.0', name: 'Dyspnoea', name_id: 'Sesak Napas (Dispnea)' },
  { code: 'R07.4', name: 'Chest pain unspecified', name_id: 'Nyeri Dada' },

  // R10-R19 Symptoms digestive/abdomen
  { code: 'R10.4', name: 'Other abdominal pain', name_id: 'Nyeri Perut' },
  { code: 'R11', name: 'Nausea and vomiting', name_id: 'Mual dan Muntah' },
  { code: 'R14', name: 'Flatulence', name_id: 'Kembung (Flatulensi)' },

  // R50-R69 General symptoms
  { code: 'R50.9', name: 'Fever unspecified', name_id: 'Demam' },
  { code: 'R51', name: 'Headache', name_id: 'Nyeri Kepala (Cephalgia)' },
  { code: 'R53', name: 'Malaise and fatigue', name_id: 'Lemas / Kelelahan' },
  { code: 'R55', name: 'Syncope and collapse', name_id: 'Pingsan (Sinkop)' },
  { code: 'R56.0', name: 'Febrile convulsions', name_id: 'Kejang Demam' },

  // S00-T98 Injury/poisoning (common ones)
  { code: 'S00.9', name: 'Superficial injury of head', name_id: 'Cedera Superfisial Kepala' },
  { code: 'S61.9', name: 'Open wound of wrist and hand', name_id: 'Luka Terbuka Tangan' },
  { code: 'S80.0', name: 'Contusion of knee', name_id: 'Memar Lutut' },
  { code: 'S93.4', name: 'Sprain of ankle', name_id: 'Keseleo Pergelangan Kaki' },
  { code: 'T14.0', name: 'Superficial injury unspecified', name_id: 'Luka Lecet / Superfisial' },
  { code: 'T14.1', name: 'Open wound unspecified', name_id: 'Luka Terbuka' },
  { code: 'T30.0', name: 'Burn unspecified degree', name_id: 'Luka Bakar' },
  { code: 'T63.4', name: 'Insect bite venomous', name_id: 'Gigitan Serangga Berbisa' },
  { code: 'T78.4', name: 'Allergy unspecified', name_id: 'Alergi Tidak Spesifik' },

  // Z00-Z99 Factors influencing health
  { code: 'Z00.0', name: 'General medical examination', name_id: 'Pemeriksaan Kesehatan Umum (Medical Check-Up)' },
  { code: 'Z23', name: 'Immunization', name_id: 'Vaksinasi / Imunisasi' },
  { code: 'Z24.1', name: 'Need for immunization against influenza', name_id: 'Vaksinasi Influenza' },
  { code: 'Z30.0', name: 'Contraceptive counselling', name_id: 'Konseling Kontrasepsi / KB' },
  { code: 'Z34.9', name: 'Supervision of normal pregnancy', name_id: 'Pemeriksaan Kehamilan Normal (ANC)' },
  { code: 'Z71.1', name: 'Person with feared complaint without diagnosis', name_id: 'Konsultasi tanpa Diagnosis (Keluhan Ditakutkan)' },
  { code: 'Z76.0', name: 'Prescription repeat', name_id: 'Resep Ulangan' },
];
