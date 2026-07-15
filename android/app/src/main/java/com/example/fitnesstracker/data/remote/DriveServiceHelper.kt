package com.example.fitnesstracker.data.remote

import com.google.api.client.http.FileContent
import com.google.api.services.drive.Drive
import com.google.api.services.drive.model.File as DriveFile
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DriveServiceHelper(private val googleDriveService: Drive) {

    /**
     * Find or create the central backup directory in the user's Google Drive storage.
     */
    suspend fun getOrCreateFolder(folderName: String): String = withContext(Dispatchers.IO) {
        val query = "name = '$folderName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        val result = googleDriveService.files().list().setQ(query).execute()
        
        val existingFolder = result.files?.firstOrNull()
        if (existingFolder != null) return@withContext existingFolder.id

        val folderMetadata = DriveFile().apply {
            name = folderName
            mimeType = "application/vnd.google-apps.folder"
        }
        val newFolder = googleDriveService.files().create(folderMetadata).setFields("id").execute()
        return@withContext newFolder.id
    }

    /**
     * Upload or update the unified backup JSON file inside the target parent folder.
     */
    suspend fun uploadFile(
        parentFolderId: String, 
        localFile: File, 
        mimeType: String = "application/json"
    ): String = withContext(Dispatchers.IO) {
        val query = "'$parentFolderId' in parents and name = '${localFile.name}' and trashed = false"
        val listResult = googleDriveService.files().list().setQ(query).execute()
        val existingFile = listResult.files?.firstOrNull()

        val mediaContent = FileContent(mimeType, localFile)
        
        if (existingFile != null) {
            // Overwrite file
            val updated = googleDriveService.files().update(existingFile.id, null, mediaContent).execute()
            return@withContext updated.id
        } else {
            // Create new file
            val fileMetadata = DriveFile().apply {
                name = localFile.name
                parents = listOf(parentFolderId)
            }
            val created = googleDriveService.files().create(fileMetadata, mediaContent).setFields("id").execute()
            return@withContext created.id
        }
    }

    /**
     * Download backup file from Google Drive to overwrite local state
     */
    suspend fun downloadFile(driveFileId: String, localTargetFile: File): Unit = withContext(Dispatchers.IO) {
        val outputStream = localTargetFile.outputStream()
        googleDriveService.files().get(driveFileId).executeMediaAndDownloadTo(outputStream)
        outputStream.close()
    }

    /**
     * Find backing file inside drive folder
     */
    suspend fun findBackupFile(parentFolderId: String, fileName: String): String? = withContext(Dispatchers.IO) {
        val query = "'$parentFolderId' in parents and name = '$fileName' and trashed = false"
        val result = googleDriveService.files().list().setQ(query).execute()
        return@withContext result.files?.firstOrNull()?.id
    }
}
