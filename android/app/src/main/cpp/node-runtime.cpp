#include <jni.h>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <string>
#include "node.h"

extern "C" JNIEXPORT jint JNICALL
Java_com_yesplaymusic_tablet_LocalApi_startNode(JNIEnv* env, jclass, jstring directory, jint port) {
    const char* path = env->GetStringUTFChars(directory, nullptr);
    std::string root(path);
    env->ReleaseStringUTFChars(directory, path);
    setenv("HOME", root.c_str(), 1);
    setenv("TMPDIR", (root + "/tmp").c_str(), 1);
    setenv("YPM_API_PORT", std::to_string(port).c_str(), 1);
    // node::Start expects writable, contiguous argument storage.
    std::string script = root + "/server.js";
    std::vector<char> args(5 + script.size() + 1);
    std::memcpy(args.data(), "node", 5);
    std::memcpy(args.data() + 5, script.c_str(), script.size() + 1);
    char* argv[] = {args.data(), args.data() + 5};
    return node::Start(2, argv);
}
