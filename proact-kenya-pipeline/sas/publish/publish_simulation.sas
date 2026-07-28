/*=============================================================================
  ProACT Kenya Pipeline - Publish Model (Simulation)
  =============================================================================
  Purpose: Extract model scores from Denodo and publish to CAS for Simulation.
  
  CAS Table: KE_model_simulation
  Target: SB_model_simulation (per diagram)
  
  Pattern:
    1. Connect to CAS session
    2. Drop existing CAS table (if exists)
    3. Load data from Denodo view into CAS (promoted)
    4. Save/persist CAS table to SASHDAT on disk
  =============================================================================*/

%macro publish_simulation();

    /* -----------------------------------------------------------------------
       Parse environment parameters
    ----------------------------------------------------------------------- */
    %let Env = %sysfunc(scan(%sysfunc(scan(&SYSPARM., 1, &)), 2, =));

    %put NOTE: ========================================================;
    %put NOTE: ProACT Kenya - Publish Simulation Model;
    %put NOTE: Environment: &Env.;
    %put NOTE: ========================================================;

    /* -----------------------------------------------------------------------
       Environment-specific settings
    ----------------------------------------------------------------------- */
    %if &Env. = dev %then %do;
        %let DenodoDSN = Denodo_AR1_test;
        %let CasLibName = CAS_AR_CSE_Kenya_Dev;
    %end;
    %else %if &Env. = uat %then %do;
        %let DenodoDSN = Denodo_AR1_test;
        %let CasLibName = CAS_AR_CSE_Kenya_UAT;
    %end;
    %else %if &Env. = prod %then %do;
        %let DenodoDSN = Denodo_AR_Prod;
        %let CasLibName = CAS_AR_CSE_Kenya;
    %end;

    %let DenodoUser = &SYSUSERID.;
    %let DenodoPassword = {SAS002}2A9EC31325E4A21B159AD9FE434A3AE850F29B5A2CA3B29E26263C1C5802B03A;
    %let DenodoView = vw_ke_proact_simulation;
    %let CASTableName = KE_model_simulation;
    %let CasLib = mycas;

    /* -----------------------------------------------------------------------
       Step 1: Start CAS session and assign library
    ----------------------------------------------------------------------- */
    cas mysas;
    libname mycas cas caslib="&CasLibName.";

    /* -----------------------------------------------------------------------
       Step 2: Connect to Denodo
    ----------------------------------------------------------------------- */
    libname DENODOAR odbc datasrc="&DenodoDSN."
        schema=rsvrdpopsarlending
        user="&DenodoUser."
        password="&DenodoPassword."
        dm_unicode="utf-16"
        PRESERVE_TAB_NAMES=YES;

    %if &syserr. > 0 %then %do;
        %put ERROR: Failed to connect to Denodo. Aborting publish.;
        cas mysas terminate;
        %abort cancel 1;
    %end;

    /* -----------------------------------------------------------------------
       Step 3: Drop existing CAS table
    ----------------------------------------------------------------------- */
    proc casutil;
        droptable casdata="&CASTableName." incaslib="&CasLibName." quiet;
    run;

    /* -----------------------------------------------------------------------
       Step 4: Load data from Denodo into CAS (promoted)
    ----------------------------------------------------------------------- */
    %put NOTE: Loading data from Denodo view [&DenodoView.] into CAS...;

    data &CasLib..&CASTableName. (promote=yes);
        set DENODOAR.&DenodoView.;
    run;

    %if &syserr. > 0 %then %do;
        %put ERROR: Failed to load data into CAS table [&CASTableName.]. Check Denodo view.;
        cas mysas terminate;
        %abort cancel 2;
    %end;

    /* -----------------------------------------------------------------------
       Step 5: Persist CAS table to SASHDAT on disk
    ----------------------------------------------------------------------- */
    proc casutil;
        save casdata="&CASTableName." incaslib="&CasLibName."
             outcaslib="&CasLibName." replace;
    run;

    %if &syserr. > 0 %then %do;
        %put ERROR: Failed to persist CAS table to disk.;
        cas mysas terminate;
        %abort cancel 3;
    %end;

    /* -----------------------------------------------------------------------
       Cleanup
    ----------------------------------------------------------------------- */
    libname DENODOAR clear;
    libname mycas clear;
    cas mysas terminate;

    %put NOTE: ========================================================;
    %put NOTE: PUBLISH COMPLETE - Simulation model scores loaded;
    %put NOTE: CAS Table: &CASTableName. | CASLib: &CasLibName.;
    %put NOTE: ========================================================;

%mend publish_simulation;

%publish_simulation();
