package store.newcitystyle.universalpro

import android.content.Context
import android.net.Uri
import android.database.sqlite.SQLiteDatabase
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.json.JSONObject

/**
 * Owner-controlled EXPORT ONLY of local Android POS state.
 *
 * - SQLite VACUUM INTO produces a consistent snapshot including committed WAL data.
 * - No writes to working bills, outbox, stock, Supabase or desktop.
 * - Backups are unencrypted; owner must store them privately.
 * - Restore is deliberately not implemented until integrity and cross-version tests pass.
 */
internal object NcsLocalPosBackup {
    const val DB_NAME = "ncs_native_pos_v21.sqlite"
    const val ZIP_DB = "ncs_native_pos.sqlite"
    const val ZIP_MANIFEST = "manifest.json"

    fun export(context:Context, destination:Uri):String {
        val app=context.applicationContext
        val source=app.getDatabasePath(DB_NAME)
        require(source.exists()){"No local POS database to back up yet"}
        val snapshot=File(app.cacheDir,"ncs-pos-snapshot-"+UUID.randomUUID()+".sqlite")
        try {
            // Deliberately reuse the SQLiteOpenHelper so pending transactions on this
            // connection are respected. No source schema or financial rows are modified.
            val store=NPosStore(app)
            try{
                val db=store.writableDatabase
                require(!db.inTransaction()){"Local bill transaction is still active"}
                // VACUUM INTO is a consistent online snapshot on supported SQLite versions.
                db.execSQL("VACUUM INTO '"+snapshot.absolutePath.replace("'","''")+"'")
            }finally{store.close()}
            require(snapshot.exists() && snapshot.length()>0){"SQLite snapshot not created"}
            val fingerprint=sha256(snapshot)
            val verify=SQLiteDatabase.openDatabase(snapshot.absolutePath,null,
                SQLiteDatabase.OPEN_READONLY)
            val counts=try{
                val integrity=verify.rawQuery("PRAGMA integrity_check",null).use{c->
                    if(c.moveToFirst())c.getString(0) else "unknown"
                }
                require(integrity=="ok"){"Backup SQLite integrity check failed: "+integrity}
                listOf("bills","bill_items","catalog","sync_queue").associateWith{table->
                    verify.rawQuery("SELECT count(*) FROM "+table,null).use{c->
                        c.moveToFirst();c.getLong(0)
                    }
                }
            }finally{verify.close()}
            val manifest=JSONObject()
                .put("format","NCS_LOCAL_POS_BACKUP_V1")
                .put("source_db",DB_NAME)
                .put("created_utc",Instant.now().toString())
                .put("sqlite_sha256",fingerprint)
                .put("sqlite_bytes",snapshot.length())
                .put("restorable",false)
            val countJson=JSONObject()
            counts.forEach{(key,value)->countJson.put(key,value)}
            manifest.put("tables",countJson)
            val stream=app.contentResolver.openOutputStream(destination,"w")
                ?:error("Cannot open the selected backup file")
            stream.use{target->
                ZipOutputStream(target).use{zip->
                    zip.putNextEntry(ZipEntry(ZIP_DB))
                    snapshot.inputStream().use{it.copyTo(zip)}
                    zip.closeEntry()
                    zip.putNextEntry(ZipEntry(ZIP_MANIFEST))
                    zip.write(manifest.toString(2).toByteArray(Charsets.UTF_8))
                    zip.closeEntry()
                    zip.finish()
                }
            }
            return "Backup exported • "+counts.getValue("bills")+" local bills • "+
                counts.getValue("sync_queue")+" sync records • SHA256 "+fingerprint.take(12)+
                "… • Keep ZIP private. Restore not yet supported."
        } finally {snapshot.delete()}
    }

    private fun sha256(file:File):String{
        val digest=MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use{input->
            val block=ByteArray(65536)
            while(true){
                val n=input.read(block)
                if(n<0)break
                if(n>0)digest.update(block,0,n)
            }
        }
        return digest.digest().joinToString(""){"%02x".format(it)}
    }
}
