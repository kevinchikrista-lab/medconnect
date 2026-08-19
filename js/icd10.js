// Daftar inti — 226 diagnosis pilihan yang dipakai sejak awal.
const INTI = [
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

// =============================================================================
// TAMBAHAN — bab yang sebelumnya kosong atau nyaris kosong
//
// Daftar inti di atas berisi 226 diagnosis pilihan tangan. Itu cukup untuk
// keluhan yang paling sering datang, tetapi bukan ICD-10: ICD-10 asli berisi
// sekitar 14.000 kode. Yang paling terasa hilang saat dipakai sungguhan:
//
//   - seluruh bab G (saraf) hanya berisi migrain dan Bell's palsy — TIDAK ADA
//     EPILEPSI, tidak ada TIA, neuropati, atau carpal tunnel
//   - R56 (kejang, termasuk kejang demam anak) tidak ada sama sekali
//   - bab C (keganasan), O (kehamilan & persalinan), P (perinatal), dan
//     Q (kelainan bawaan) kosong seluruhnya
//
// PERINGATAN YANG TIDAK BOLEH DIHAPUS
//
// Kode di bawah ditulis dari pengetahuan umum tentang ICD-10, BUKAN disalin
// dari terbitan resmi WHO atau buku ICD-10 Kemenkes — lingkungan tempat kode
// ini ditulis tidak bisa mengunduhnya. Untuk pemakaian klinis sehari-hari
// ketelitiannya memadai, tetapi untuk KLAIM BPJS dan PELAPORAN, kode yang
// dipakai sebaiknya dicocokkan dulu dengan buku ICD-10 yang berlaku. Kode
// yang salah pada klaim bukan perkara kosmetik.
//
// Kalau ada kode yang keliru atau kurang, jangan menunggu perubahan kode:
// tambahkan sendiri lewat tombol di layar pencarian diagnosis. Kode yang
// ditambahkan tersimpan untuk seluruh klinik.
// =============================================================================
const TAMBAHAN = [
  // ---- A/B: infeksi yang belum tercakup -----------------------------------
  { code: 'A15.3', name: 'Tuberculosis of lung, confirmed by unspecified means', name_id: 'TB Paru Terkonfirmasi' },
  { code: 'A16.2', name: 'Tuberculosis of lung without mention of bacteriological confirmation', name_id: 'TB Paru Klinis (Tanpa Konfirmasi Bakteriologis)' },
  { code: 'A41.9', name: 'Sepsis, unspecified', name_id: 'Sepsis' },
  { code: 'A53.9', name: 'Syphilis, unspecified', name_id: 'Sifilis' },
  { code: 'A63.0', name: 'Anogenital warts', name_id: 'Kondiloma Akuminata (Kutil Kelamin)' },
  { code: 'B20', name: 'HIV disease resulting in infectious and parasitic diseases', name_id: 'HIV dengan Infeksi Oportunistik' },
  { code: 'B24', name: 'Unspecified HIV disease', name_id: 'HIV, Tidak Spesifik' },
  { code: 'B50.9', name: 'Plasmodium falciparum malaria, unspecified', name_id: 'Malaria Falciparum' },
  { code: 'B51.9', name: 'Plasmodium vivax malaria without complication', name_id: 'Malaria Vivax' },
  { code: 'B54', name: 'Unspecified malaria', name_id: 'Malaria, Tidak Spesifik' },
  { code: 'B99', name: 'Other and unspecified infectious diseases', name_id: 'Penyakit Infeksi Lain / Tidak Spesifik' },
  { code: 'U07.1', name: 'COVID-19, virus identified', name_id: 'COVID-19 (Terkonfirmasi)' },
  { code: 'U07.2', name: 'COVID-19, virus not identified', name_id: 'COVID-19 (Klinis/Epidemiologis)' },

  // ---- C: keganasan (bab ini sebelumnya KOSONG) ---------------------------
  { code: 'C16.9', name: 'Malignant neoplasm of stomach', name_id: 'Kanker Lambung' },
  { code: 'C18.9', name: 'Malignant neoplasm of colon', name_id: 'Kanker Kolon' },
  { code: 'C20', name: 'Malignant neoplasm of rectum', name_id: 'Kanker Rektum' },
  { code: 'C22.0', name: 'Liver cell carcinoma', name_id: 'Karsinoma Hepatoseluler' },
  { code: 'C34.9', name: 'Malignant neoplasm of bronchus and lung', name_id: 'Kanker Paru' },
  { code: 'C50.9', name: 'Malignant neoplasm of breast', name_id: 'Kanker Payudara' },
  { code: 'C53.9', name: 'Malignant neoplasm of cervix uteri', name_id: 'Kanker Serviks' },
  { code: 'C56', name: 'Malignant neoplasm of ovary', name_id: 'Kanker Ovarium' },
  { code: 'C61', name: 'Malignant neoplasm of prostate', name_id: 'Kanker Prostat' },
  { code: 'C73', name: 'Malignant neoplasm of thyroid gland', name_id: 'Kanker Tiroid' },
  { code: 'C80.9', name: 'Malignant neoplasm, primary site unspecified', name_id: 'Keganasan, Lokasi Primer Tidak Diketahui' },
  { code: 'C91.0', name: 'Acute lymphoblastic leukaemia', name_id: 'Leukemia Limfoblastik Akut (ALL)' },
  { code: 'C92.0', name: 'Acute myeloblastic leukaemia', name_id: 'Leukemia Mieloblastik Akut (AML)' },
  { code: 'D17.9', name: 'Benign lipomatous neoplasm', name_id: 'Lipoma' },
  { code: 'D22.9', name: 'Melanocytic naevi', name_id: 'Nevus Pigmentosus (Tahi Lalat)' },
  { code: 'D25.9', name: 'Leiomyoma of uterus', name_id: 'Mioma Uteri' },

  // ---- D: darah -----------------------------------------------------------
  { code: 'D51.9', name: 'Vitamin B12 deficiency anaemia', name_id: 'Anemia Defisiensi Vitamin B12' },
  { code: 'D52.9', name: 'Folate deficiency anaemia', name_id: 'Anemia Defisiensi Folat' },
  { code: 'D56.9', name: 'Thalassaemia, unspecified', name_id: 'Talasemia' },
  { code: 'D62', name: 'Acute posthaemorrhagic anaemia', name_id: 'Anemia Akut Pasca Perdarahan' },
  { code: 'D69.3', name: 'Idiopathic thrombocytopenic purpura', name_id: 'ITP (Trombositopenia Imun)' },
  { code: 'D70', name: 'Agranulocytosis', name_id: 'Agranulositosis / Neutropenia' },

  // ---- E: endokrin & metabolik --------------------------------------------
  { code: 'E04.9', name: 'Nontoxic goitre, unspecified', name_id: 'Struma Nontoksik' },
  { code: 'E10.1', name: 'Type 1 diabetes mellitus with ketoacidosis', name_id: 'DM Tipe 1 dengan Ketoasidosis' },
  { code: 'E11.1', name: 'Type 2 diabetes mellitus with ketoacidosis', name_id: 'DM Tipe 2 dengan Ketoasidosis' },
  { code: 'E11.2', name: 'Type 2 diabetes mellitus with renal complications', name_id: 'DM Tipe 2 dengan Nefropati' },
  { code: 'E11.3', name: 'Type 2 diabetes mellitus with ophthalmic complications', name_id: 'DM Tipe 2 dengan Retinopati' },
  { code: 'E11.4', name: 'Type 2 diabetes mellitus with neurological complications', name_id: 'DM Tipe 2 dengan Neuropati' },
  { code: 'E11.5', name: 'Type 2 diabetes mellitus with peripheral circulatory complications', name_id: 'DM Tipe 2 dengan Gangguan Sirkulasi (Kaki Diabetik)' },
  { code: 'E16.2', name: 'Hypoglycaemia, unspecified', name_id: 'Hipoglikemia' },
  { code: 'E66.0', name: 'Obesity due to excess calories', name_id: 'Obesitas' },
  { code: 'E73.9', name: 'Lactose intolerance, unspecified', name_id: 'Intoleransi Laktosa' },
  { code: 'E86', name: 'Volume depletion', name_id: 'Dehidrasi' },
  { code: 'E87.1', name: 'Hypo-osmolality and hyponatraemia', name_id: 'Hiponatremia' },
  { code: 'E87.6', name: 'Hypokalaemia', name_id: 'Hipokalemia' },

  // ---- F: jiwa & perilaku -------------------------------------------------
  { code: 'F00.9', name: "Dementia in Alzheimer's disease", name_id: 'Demensia Alzheimer' },
  { code: 'F03', name: 'Unspecified dementia', name_id: 'Demensia, Tidak Spesifik' },
  { code: 'F10.2', name: 'Alcohol dependence syndrome', name_id: 'Ketergantungan Alkohol' },
  { code: 'F17.2', name: 'Nicotine dependence', name_id: 'Ketergantungan Nikotin' },
  { code: 'F20.9', name: 'Schizophrenia, unspecified', name_id: 'Skizofrenia' },
  { code: 'F25.9', name: 'Schizoaffective disorder', name_id: 'Gangguan Skizoafektif' },
  { code: 'F31.9', name: 'Bipolar affective disorder, unspecified', name_id: 'Gangguan Bipolar' },
  { code: 'F32.0', name: 'Mild depressive episode', name_id: 'Episode Depresi Ringan' },
  { code: 'F32.1', name: 'Moderate depressive episode', name_id: 'Episode Depresi Sedang' },
  { code: 'F32.2', name: 'Severe depressive episode without psychotic symptoms', name_id: 'Episode Depresi Berat Tanpa Gejala Psikotik' },
  { code: 'F33.9', name: 'Recurrent depressive disorder, unspecified', name_id: 'Gangguan Depresi Berulang' },
  { code: 'F40.1', name: 'Social phobias', name_id: 'Fobia Sosial' },
  { code: 'F42.9', name: 'Obsessive-compulsive disorder', name_id: 'Gangguan Obsesif-Kompulsif (OCD)' },
  { code: 'F43.1', name: 'Post-traumatic stress disorder', name_id: 'PTSD' },
  { code: 'F43.2', name: 'Adjustment disorders', name_id: 'Gangguan Penyesuaian' },
  { code: 'F45.9', name: 'Somatoform disorder, unspecified', name_id: 'Gangguan Somatoform' },
  { code: 'F84.0', name: 'Childhood autism', name_id: 'Autisme Masa Kanak' },
  { code: 'F90.9', name: 'Hyperkinetic disorder, unspecified', name_id: 'ADHD / Gangguan Hiperkinetik' },

  // ---- G: saraf — INI YANG PALING KURANG ----------------------------------
  { code: 'G00.9', name: 'Bacterial meningitis, unspecified', name_id: 'Meningitis Bakterial' },
  { code: 'G03.9', name: 'Meningitis, unspecified', name_id: 'Meningitis, Tidak Spesifik' },
  { code: 'G20', name: "Parkinson's disease", name_id: 'Penyakit Parkinson' },
  { code: 'G35', name: 'Multiple sclerosis', name_id: 'Multiple Sclerosis' },
  { code: 'G40.0', name: 'Localization-related idiopathic epilepsy with seizures of localized onset', name_id: 'Epilepsi Fokal Idiopatik' },
  { code: 'G40.2', name: 'Localization-related symptomatic epilepsy with complex partial seizures', name_id: 'Epilepsi Fokal Simtomatik (Kejang Parsial Kompleks)' },
  { code: 'G40.3', name: 'Generalized idiopathic epilepsy and epileptic syndromes', name_id: 'Epilepsi Umum Idiopatik' },
  { code: 'G40.6', name: 'Grand mal seizures, unspecified', name_id: 'Epilepsi Grand Mal' },
  { code: 'G40.9', name: 'Epilepsy, unspecified', name_id: 'Epilepsi, Tidak Spesifik' },
  { code: 'G41.0', name: 'Grand mal status epilepticus', name_id: 'Status Epileptikus Grand Mal' },
  { code: 'G41.9', name: 'Status epilepticus, unspecified', name_id: 'Status Epileptikus' },
  { code: 'G43.0', name: 'Migraine without aura', name_id: 'Migrain Tanpa Aura' },
  { code: 'G43.1', name: 'Migraine with aura', name_id: 'Migrain dengan Aura' },
  { code: 'G45.9', name: 'Transient cerebral ischaemic attack, unspecified', name_id: 'TIA (Serangan Iskemik Sepintas)' },
  { code: 'G47.0', name: 'Disorders of initiating and maintaining sleep', name_id: 'Insomnia' },
  { code: 'G47.3', name: 'Sleep apnoea', name_id: 'Sleep Apnea' },
  { code: 'G50.0', name: 'Trigeminal neuralgia', name_id: 'Neuralgia Trigeminal' },
  { code: 'G54.4', name: 'Lumbosacral root disorders', name_id: 'Radikulopati Lumbosakral' },
  { code: 'G56.0', name: 'Carpal tunnel syndrome', name_id: 'Carpal Tunnel Syndrome' },
  { code: 'G57.0', name: 'Lesion of sciatic nerve', name_id: 'Lesi Nervus Iskiadikus' },
  { code: 'G62.9', name: 'Polyneuropathy, unspecified', name_id: 'Polineuropati' },
  { code: 'G63.2', name: 'Diabetic polyneuropathy', name_id: 'Polineuropati Diabetik' },
  { code: 'G80.9', name: 'Cerebral palsy, unspecified', name_id: 'Cerebral Palsy' },
  { code: 'G81.9', name: 'Hemiplegia, unspecified', name_id: 'Hemiplegia' },
  { code: 'G91.9', name: 'Hydrocephalus, unspecified', name_id: 'Hidrosefalus' },

  // ---- H: mata & telinga --------------------------------------------------
  { code: 'H16.9', name: 'Keratitis, unspecified', name_id: 'Keratitis' },
  { code: 'H20.9', name: 'Iridocyclitis, unspecified', name_id: 'Iridosiklitis (Uveitis Anterior)' },
  { code: 'H26.9', name: 'Cataract, unspecified', name_id: 'Katarak, Tidak Spesifik' },
  { code: 'H36.0', name: 'Diabetic retinopathy', name_id: 'Retinopati Diabetik' },
  { code: 'H40.9', name: 'Glaucoma, unspecified', name_id: 'Glaukoma' },
  { code: 'H52.0', name: 'Hypermetropia', name_id: 'Hipermetropia (Rabun Dekat)' },
  { code: 'H52.2', name: 'Astigmatism', name_id: 'Astigmatisme' },
  { code: 'H52.4', name: 'Presbyopia', name_id: 'Presbiopia' },
  { code: 'H61.2', name: 'Impacted cerumen', name_id: 'Serumen Obturans (Kotoran Telinga Menyumbat)' },
  { code: 'H72.0', name: 'Central perforation of tympanic membrane', name_id: 'Perforasi Membran Timpani' },
  { code: 'H81.0', name: "Meniere's disease", name_id: 'Penyakit Meniere' },
  { code: 'H90.3', name: 'Sensorineural hearing loss, bilateral', name_id: 'Tuli Sensorineural Bilateral' },
  { code: 'H91.9', name: 'Hearing loss, unspecified', name_id: 'Gangguan Pendengaran' },
  { code: 'H93.1', name: 'Tinnitus', name_id: 'Tinitus' },

  // ---- I: jantung & pembuluh darah ----------------------------------------
  { code: 'I15.9', name: 'Secondary hypertension, unspecified', name_id: 'Hipertensi Sekunder' },
  { code: 'I48', name: 'Atrial fibrillation and flutter', name_id: 'Fibrilasi Atrium' },
  { code: 'I50.0', name: 'Congestive heart failure', name_id: 'Gagal Jantung Kongestif' },
  { code: 'I50.9', name: 'Heart failure, unspecified', name_id: 'Gagal Jantung' },
  { code: 'I61.9', name: 'Intracerebral haemorrhage, unspecified', name_id: 'Stroke Hemoragik' },
  { code: 'I69.3', name: 'Sequelae of cerebral infarction', name_id: 'Sekuele Stroke Iskemik' },
  { code: 'I80.2', name: 'Phlebitis and thrombophlebitis of deep vessels of lower extremities', name_id: 'Trombosis Vena Dalam (DVT)' },
  { code: 'I95.9', name: 'Hypotension, unspecified', name_id: 'Hipotensi' },

  // ---- J: pernapasan ------------------------------------------------------
  { code: 'J12.9', name: 'Viral pneumonia, unspecified', name_id: 'Pneumonia Viral' },
  { code: 'J13', name: 'Pneumonia due to Streptococcus pneumoniae', name_id: 'Pneumonia Pneumokokus' },
  { code: 'J43.9', name: 'Emphysema, unspecified', name_id: 'Emfisema' },
  { code: 'J46', name: 'Status asthmaticus', name_id: 'Status Asmatikus' },
  { code: 'J47', name: 'Bronchiectasis', name_id: 'Bronkiektasis' },
  { code: 'J90', name: 'Pleural effusion', name_id: 'Efusi Pleura' },
  { code: 'J93.9', name: 'Pneumothorax, unspecified', name_id: 'Pneumotoraks' },

  // ---- K: pencernaan ------------------------------------------------------
  { code: 'K42.9', name: 'Umbilical hernia without obstruction or gangrene', name_id: 'Hernia Umbilikalis' },
  { code: 'K57.9', name: 'Diverticular disease of intestine', name_id: 'Penyakit Divertikular' },
  { code: 'K60.2', name: 'Anal fissure, unspecified', name_id: 'Fisura Ani' },
  { code: 'K64.9', name: 'Haemorrhoids, unspecified', name_id: 'Hemoroid' },
  { code: 'K73.9', name: 'Chronic hepatitis, unspecified', name_id: 'Hepatitis Kronik' },
  { code: 'K74.6', name: 'Other and unspecified cirrhosis of liver', name_id: 'Sirosis Hati' },
  { code: 'K80.2', name: 'Calculus of gallbladder without cholecystitis', name_id: 'Batu Empedu' },
  { code: 'K81.0', name: 'Acute cholecystitis', name_id: 'Kolesistitis Akut' },
  { code: 'K85.9', name: 'Acute pancreatitis, unspecified', name_id: 'Pankreatitis Akut' },
  { code: 'K92.2', name: 'Gastrointestinal haemorrhage, unspecified', name_id: 'Perdarahan Saluran Cerna' },

  // ---- L: kulit -----------------------------------------------------------
  { code: 'L21.9', name: 'Seborrhoeic dermatitis, unspecified', name_id: 'Dermatitis Seboroik' },
  { code: 'L42', name: 'Pityriasis rosea', name_id: 'Pitiriasis Rosea' },
  { code: 'L43.9', name: 'Lichen planus, unspecified', name_id: 'Liken Planus' },
  { code: 'L63.9', name: 'Alopecia areata, unspecified', name_id: 'Alopesia Areata' },
  { code: 'L80', name: 'Vitiligo', name_id: 'Vitiligo' },
  { code: 'L81.4', name: 'Other melanin hyperpigmentation', name_id: 'Melasma / Hiperpigmentasi' },
  { code: 'L82', name: 'Seborrhoeic keratosis', name_id: 'Keratosis Seboroik' },
  { code: 'L84', name: 'Corns and callosities', name_id: 'Kalus / Mata Ikan' },
  { code: 'L89.9', name: 'Decubitus ulcer, unspecified', name_id: 'Ulkus Dekubitus' },
  { code: 'L91.0', name: 'Hypertrophic scar', name_id: 'Keloid / Parut Hipertrofik' },
  { code: 'L98.4', name: 'Chronic ulcer of skin, not elsewhere classified', name_id: 'Ulkus Kulit Kronik' },

  // ---- M: otot & rangka ---------------------------------------------------
  { code: 'M15.9', name: 'Polyarthrosis, unspecified', name_id: 'Poliartrosis' },
  { code: 'M16.9', name: 'Coxarthrosis, unspecified', name_id: 'Osteoartritis Panggul' },
  { code: 'M20.1', name: 'Hallux valgus (acquired)', name_id: 'Hallux Valgus' },
  { code: 'M32.9', name: 'Systemic lupus erythematosus, unspecified', name_id: 'Lupus Eritematosus Sistemik (SLE)' },
  { code: 'M41.9', name: 'Scoliosis, unspecified', name_id: 'Skoliosis' },
  { code: 'M45', name: 'Ankylosing spondylitis', name_id: 'Spondilitis Ankilosa' },
  { code: 'M50.1', name: 'Cervical disc disorder with radiculopathy', name_id: 'HNP Servikal dengan Radikulopati' },
  { code: 'M53.1', name: 'Cervicobrachial syndrome', name_id: 'Sindrom Servikobrakial' },
  { code: 'M54.1', name: 'Radiculopathy', name_id: 'Radikulopati' },
  { code: 'M54.3', name: 'Sciatica', name_id: 'Iskialgia' },
  { code: 'M54.4', name: 'Lumbago with sciatica', name_id: 'Nyeri Pinggang dengan Iskialgia' },
  { code: 'M75.0', name: 'Adhesive capsulitis of shoulder', name_id: 'Frozen Shoulder' },
  { code: 'M76.6', name: 'Achilles tendinitis', name_id: 'Tendinitis Achilles' },
  { code: 'M81.9', name: 'Osteoporosis, unspecified', name_id: 'Osteoporosis' },
  { code: 'M86.9', name: 'Osteomyelitis, unspecified', name_id: 'Osteomielitis' },

  // ---- N: ginjal & kelamin ------------------------------------------------
  { code: 'N04.9', name: 'Nephrotic syndrome, unspecified', name_id: 'Sindrom Nefrotik' },
  { code: 'N17.9', name: 'Acute renal failure, unspecified', name_id: 'Gagal Ginjal Akut' },
  { code: 'N18.3', name: 'Chronic kidney disease, stage 3', name_id: 'Penyakit Ginjal Kronik Stadium 3' },
  { code: 'N18.4', name: 'Chronic kidney disease, stage 4', name_id: 'Penyakit Ginjal Kronik Stadium 4' },
  { code: 'N18.5', name: 'Chronic kidney disease, stage 5', name_id: 'Penyakit Ginjal Kronik Stadium 5' },
  { code: 'N43.3', name: 'Hydrocele, unspecified', name_id: 'Hidrokel' },
  { code: 'N47', name: 'Redundant prepuce, phimosis and paraphimosis', name_id: 'Fimosis / Parafimosis' },
  { code: 'N63', name: 'Unspecified lump in breast', name_id: 'Benjolan Payudara' },
  { code: 'N70.9', name: 'Salpingitis and oophoritis, unspecified', name_id: 'Salpingitis / Ooforitis' },
  { code: 'N80.9', name: 'Endometriosis, unspecified', name_id: 'Endometriosis' },
  { code: 'N83.2', name: 'Other and unspecified ovarian cysts', name_id: 'Kista Ovarium' },
  { code: 'N93.9', name: 'Abnormal uterine and vaginal bleeding, unspecified', name_id: 'Perdarahan Uterus Abnormal' },
  { code: 'N95.1', name: 'Menopausal and female climacteric states', name_id: 'Menopause / Klimakterium' },
  { code: 'N97.9', name: 'Female infertility, unspecified', name_id: 'Infertilitas Wanita' },

  // ---- O: kehamilan & persalinan (bab ini sebelumnya KOSONG) --------------
  { code: 'O00.9', name: 'Ectopic pregnancy, unspecified', name_id: 'Kehamilan Ektopik' },
  { code: 'O03.9', name: 'Spontaneous abortion, complete or unspecified', name_id: 'Abortus Spontan' },
  { code: 'O13', name: 'Gestational hypertension', name_id: 'Hipertensi Gestasional' },
  { code: 'O14.9', name: 'Pre-eclampsia, unspecified', name_id: 'Preeklampsia' },
  { code: 'O15.9', name: 'Eclampsia, unspecified as to time period', name_id: 'Eklampsia' },
  { code: 'O21.0', name: 'Mild hyperemesis gravidarum', name_id: 'Hiperemesis Gravidarum Ringan' },
  { code: 'O24.4', name: 'Diabetes mellitus arising in pregnancy', name_id: 'Diabetes Gestasional' },
  { code: 'O47.9', name: 'False labour, unspecified', name_id: 'Kontraksi Palsu (Braxton Hicks)' },
  { code: 'O80', name: 'Single spontaneous delivery', name_id: 'Persalinan Spontan Tunggal' },
  { code: 'O99.0', name: 'Anaemia complicating pregnancy', name_id: 'Anemia dalam Kehamilan' },

  // ---- P: perinatal (bab ini sebelumnya KOSONG) ---------------------------
  { code: 'P05.9', name: 'Slow fetal growth, unspecified', name_id: 'Pertumbuhan Janin Terhambat' },
  { code: 'P07.1', name: 'Other low birth weight', name_id: 'Berat Badan Lahir Rendah (BBLR)' },
  { code: 'P07.3', name: 'Other preterm infants', name_id: 'Bayi Prematur' },
  { code: 'P22.0', name: 'Respiratory distress syndrome of newborn', name_id: 'Sindrom Gawat Napas Neonatus' },
  { code: 'P36.9', name: 'Bacterial sepsis of newborn, unspecified', name_id: 'Sepsis Neonatorum' },
  { code: 'P59.9', name: 'Neonatal jaundice, unspecified', name_id: 'Ikterus Neonatorum' },
  { code: 'P92.9', name: 'Feeding problem of newborn, unspecified', name_id: 'Masalah Minum pada Neonatus' },

  // ---- Q: kelainan bawaan (bab ini sebelumnya KOSONG) ---------------------
  { code: 'Q21.0', name: 'Ventricular septal defect', name_id: 'VSD (Defek Septum Ventrikel)' },
  { code: 'Q21.1', name: 'Atrial septal defect', name_id: 'ASD (Defek Septum Atrium)' },
  { code: 'Q25.0', name: 'Patent ductus arteriosus', name_id: 'PDA (Duktus Arteriosus Persisten)' },
  { code: 'Q35.9', name: 'Cleft palate, unspecified', name_id: 'Celah Langit-langit (Palatoskisis)' },
  { code: 'Q36.9', name: 'Cleft lip, unilateral', name_id: 'Bibir Sumbing (Labioskisis)' },
  { code: 'Q37.9', name: 'Unspecified cleft palate with unilateral cleft lip', name_id: 'Labiopalatoskisis' },
  { code: 'Q53.9', name: 'Undescended testicle, unspecified', name_id: 'Kriptorkismus (Testis Tidak Turun)' },
  { code: 'Q54.9', name: 'Hypospadias, unspecified', name_id: 'Hipospadia' },
  { code: 'Q66.0', name: 'Talipes equinovarus', name_id: 'CTEV (Kaki Pengkor)' },
  { code: 'Q90.9', name: "Down's syndrome, unspecified", name_id: 'Sindrom Down' },

  // ---- R: gejala & tanda --------------------------------------------------
  { code: 'R00.0', name: 'Tachycardia, unspecified', name_id: 'Takikardia' },
  { code: 'R04.0', name: 'Epistaxis', name_id: 'Epistaksis (Mimisan)' },
  { code: 'R21', name: 'Rash and other nonspecific skin eruption', name_id: 'Ruam Kulit Tidak Spesifik' },
  { code: 'R31', name: 'Unspecified haematuria', name_id: 'Hematuria' },
  { code: 'R33', name: 'Retention of urine', name_id: 'Retensi Urin' },
  { code: 'R40.2', name: 'Coma, unspecified', name_id: 'Penurunan Kesadaran / Koma' },
  { code: 'R42', name: 'Dizziness and giddiness', name_id: 'Pusing Berputar / Vertigo Tidak Spesifik' },
  { code: 'R56.8', name: 'Other and unspecified convulsions', name_id: 'Kejang, Tidak Spesifik' },
  { code: 'R60.0', name: 'Localized oedema', name_id: 'Edema Lokal' },
  { code: 'R63.0', name: 'Anorexia', name_id: 'Nafsu Makan Menurun' },
  { code: 'R63.4', name: 'Abnormal weight loss', name_id: 'Penurunan Berat Badan' },
  { code: 'R73.9', name: 'Hyperglycaemia, unspecified', name_id: 'Hiperglikemia' },

  // ---- S/T: cedera & keracunan --------------------------------------------
  { code: 'S01.9', name: 'Open wound of head, part unspecified', name_id: 'Luka Terbuka Kepala' },
  { code: 'S06.0', name: 'Concussion', name_id: 'Komosio Serebri (Gegar Otak)' },
  { code: 'S22.3', name: 'Fracture of one rib', name_id: 'Fraktur Iga' },
  { code: 'S42.0', name: 'Fracture of clavicle', name_id: 'Fraktur Klavikula' },
  { code: 'S52.5', name: 'Fracture of lower end of radius', name_id: 'Fraktur Radius Distal' },
  { code: 'S72.0', name: 'Fracture of neck of femur', name_id: 'Fraktur Kolum Femur' },
  { code: 'S83.6', name: 'Sprain and strain of other parts of knee', name_id: 'Sprain Lutut' },
  { code: 'T78.2', name: 'Anaphylactic shock, unspecified', name_id: 'Syok Anafilaktik' },
  { code: 'T88.7', name: 'Unspecified adverse effect of drug or medicament', name_id: 'Efek Samping Obat' },

  // ---- Z: faktor yang memengaruhi status kesehatan ------------------------
  { code: 'Z00.1', name: 'Routine child health examination', name_id: 'Pemeriksaan Kesehatan Anak Rutin' },
  { code: 'Z02.7', name: 'Issue of medical certificate', name_id: 'Penerbitan Surat Keterangan Sehat/Sakit' },
  { code: 'Z03.9', name: 'Observation for suspected disease or condition, unspecified', name_id: 'Observasi Dugaan Penyakit' },
  { code: 'Z13.9', name: 'Special screening examination, unspecified', name_id: 'Skrining Kesehatan' },
  { code: 'Z33', name: 'Pregnant state, incidental', name_id: 'Keadaan Hamil (Insidental)' },
  { code: 'Z35.9', name: 'Supervision of high-risk pregnancy, unspecified', name_id: 'Pemeriksaan Kehamilan Risiko Tinggi' },
  { code: 'Z37.0', name: 'Single live birth', name_id: 'Kelahiran Hidup Tunggal' },
  { code: 'Z39.1', name: 'Care and examination of lactating mother', name_id: 'Pemeriksaan Ibu Menyusui' },
  { code: 'Z39.2', name: 'Routine postpartum follow-up', name_id: 'Kontrol Nifas Rutin' },
  { code: 'Z48.0', name: 'Attention to surgical dressings and sutures', name_id: 'Ganti Verban / Angkat Jahitan' },
  { code: 'Z72.0', name: 'Tobacco use', name_id: 'Kebiasaan Merokok' },
];

// Kode yang sama tidak boleh muncul dua kali di kotak pencarian: dokter yang
// melihat dua baris identik akan ragu mana yang benar. Yang pertama menang,
// jadi daftar inti tetap memegang nama Indonesianya bila ada bentrokan.
function gabung(inti, tambahan) {
  const lihat = new Set(inti.map(d => d.code));
  const keluar = inti.slice();
  for (const d of tambahan) {
    if (lihat.has(d.code)) continue;
    lihat.add(d.code);
    keluar.push(d);
  }
  return keluar;
}

export const ICD10 = gabung(INTI, TAMBAHAN);
